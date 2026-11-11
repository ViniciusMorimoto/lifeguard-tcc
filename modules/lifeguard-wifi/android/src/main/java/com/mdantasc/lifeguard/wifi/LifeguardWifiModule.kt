package com.mdantasc.lifeguard.wifi

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.net.wifi.WifiManager
import android.os.Build
import android.os.ParcelUuid
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.io.OutputStreamWriter
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class LifeguardWifiModule : Module() {
  private val bleServiceUuid = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e")
  private val bleCommandUuid = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e")
  private var deviceNetwork: Network? = null
  private var deviceCallback: ConnectivityManager.NetworkCallback? = null
  private var bleGatt: BluetoothGatt? = null
  private var bleCommandCharacteristic: BluetoothGattCharacteristic? = null
  private var bleConnectContinuation: CancellableContinuation<Unit>? = null
  private var bleWriteContinuation: CancellableContinuation<Unit>? = null

  override fun definition() = ModuleDefinition {
    Name("LifeguardWifi")

    AsyncFunction<List<Map<String, Any>>>("scanNetworksAsync") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        ?: throw IllegalStateException("O Wi-Fi não está disponível neste aparelho.")

      wifiManager.startScan()
      return@AsyncFunction wifiManager.scanResults
        .asSequence()
        .filter { it.SSID.isNotBlank() }
        .groupBy { it.SSID }
        .map { (ssid, results) ->
          val strongest = results.maxBy { it.level }
          mapOf(
            "ssid" to ssid,
            "level" to strongest.level,
            "frequency" to strongest.frequency
          )
        }
        .sortedByDescending { it["level"] as Int }
        .toList()
    }

    AsyncFunction("connectToDeviceAsync") Coroutine { ssid: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw IllegalStateException("A conexão com o ponto de acesso requer Android 10 ou superior.")
      }
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      disconnect(connectivity)
      val request = NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .setNetworkSpecifier(WifiNetworkSpecifier.Builder().setSsid(ssid).build())
        .build()

      try {
        withTimeout(30_000) {
          suspendCancellableCoroutine<Unit> { continuation ->
            val callback = object : ConnectivityManager.NetworkCallback() {
              override fun onAvailable(network: Network) {
                deviceNetwork = network
                deviceCallback = this
                if (continuation.isActive) continuation.resume(Unit)
              }

              override fun onUnavailable() {
                if (continuation.isActive) {
                  continuation.resumeWithException(
                    IllegalStateException("Não foi possível conectar ao ponto de acesso do ESP32. Confirme que ele está ligado e tente novamente.")
                  )
                }
              }

              override fun onLost(network: Network) {
                if (deviceNetwork == network) deviceNetwork = null
                if (continuation.isActive) {
                  continuation.resumeWithException(IllegalStateException("A conexão Wi-Fi com o ESP32 foi interrompida."))
                }
              }
            }
            deviceCallback = callback
            connectivity.requestNetwork(request, callback, 30_000)
            continuation.invokeOnCancellation { disconnect(connectivity) }
          }
        }
      } catch (error: Throwable) {
        disconnect(connectivity)
        if (error is kotlinx.coroutines.TimeoutCancellationException) {
          throw IllegalStateException("Tempo esgotado ao conectar ao ESP32. Confirme que a rede LIFEGUARD-ESP32 está ativa.")
        }
        throw error
      }
    }

    AsyncFunction("openWifiSettingsAsync") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val intent = Intent(Settings.ACTION_WIFI_SETTINGS)
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    AsyncFunction("checkDeviceWifiConnectionAsync") Coroutine { ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val wifiNetworks = connectivity.allNetworks.filter { network ->
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return@filter false
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
      }
      for (network in wifiNetworks) {
        try {
          val connection = network.openConnection(URL("http://192.168.4.1/")) as HttpURLConnection
          try {
            connection.connectTimeout = 1_500
            connection.readTimeout = 1_500
            connection.requestMethod = "GET"
            if (connection.responseCode in 100..599) {
              deviceNetwork = network
              return@Coroutine true
            }
          } finally {
            connection.disconnect()
          }
        } catch (_: IOException) {
          continue
        }
      }
      deviceNetwork = null
      false
    }

    AsyncFunction("provisionDeviceAsync") { ssid: String, password: String, credential: String ->
      val network = deviceNetwork ?: throw IllegalStateException("Conecte-se primeiro ao ponto de acesso do ESP32.")
      val body = listOf("ssid" to ssid, "password" to password, "credential" to credential)
        .joinToString("&") { (key, value) -> "${URLEncoder.encode(key, "UTF-8")}=${URLEncoder.encode(value, "UTF-8")}" }
      val connection = (network.openConnection(URL("http://192.168.4.1/provision")) as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 12_000
        readTimeout = 12_000
        doOutput = true
        setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
      }
      try {
        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body) }
        if (connection.responseCode !in 200..299) {
          throw IllegalStateException("O ESP32 recusou a configuração. Confira os dados e tente novamente.")
        }
      } finally {
        connection.disconnect()
      }
    }

    AsyncFunction("scanBleDevicesAsync") Coroutine { ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      requireBluetoothPermission(context, Manifest.permission.BLUETOOTH_SCAN)
      requireBluetoothPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
      val adapter = bluetoothAdapter(context)
      if (!adapter.isEnabled) throw IllegalStateException("Ative o Bluetooth do celular para buscar o ESP32.")
      val scanner = adapter.bluetoothLeScanner
        ?: throw IllegalStateException("O Bluetooth Low Energy não está disponível neste aparelho.")
      val devices = ConcurrentHashMap<String, Map<String, String>>()
      val scanFailure = AtomicInteger(0)
      val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
          devices[result.device.address] = mapOf(
            "id" to result.device.address,
            "name" to (result.scanRecord?.deviceName ?: "LIFEGUARD-ESP32")
          )
        }

        override fun onScanFailed(errorCode: Int) {
          scanFailure.set(errorCode)
        }
      }

      try {
        scanner.startScan(
          listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(bleServiceUuid)).build()),
          ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
          callback
        )
        delay(8_000)
        val errorCode = scanFailure.get()
        if (errorCode != 0) throw IllegalStateException("A busca Bluetooth falhou (código $errorCode).")
        devices.values.sortedBy { it["name"] }
      } finally {
        scanner.stopScan(callback)
      }
    }

    AsyncFunction("connectBleDeviceAsync") Coroutine { address: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      requireBluetoothPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
      val adapter = bluetoothAdapter(context)
      if (!adapter.isEnabled) throw IllegalStateException("Ative o Bluetooth do celular para conectar ao ESP32.")
      disconnectBle()

      try {
        withTimeout(25_000) {
          suspendCancellableCoroutine<Unit> { continuation ->
            bleConnectContinuation = continuation
            val callback = object : BluetoothGattCallback() {
              override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                  failBleConnect(IllegalStateException("Falha na conexão Bluetooth com o ESP32 (código $status)."))
                } else if (newState == BluetoothProfile.STATE_CONNECTED) {
                  if (!gatt.requestMtu(185)) gatt.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED && continuation.isActive) {
                  failBleConnect(IllegalStateException("A conexão Bluetooth com o ESP32 foi encerrada."))
                }
              }

              override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
                gatt.discoverServices()
              }

              override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                val characteristic = gatt.getService(bleServiceUuid)?.getCharacteristic(bleCommandUuid)
                if (status != BluetoothGatt.GATT_SUCCESS || characteristic == null) {
                  failBleConnect(IllegalStateException("O serviço de configuração BLE não foi encontrado no ESP32."))
                  return
                }
                bleGatt = gatt
                bleCommandCharacteristic = characteristic
                bleConnectContinuation = null
                if (continuation.isActive) continuation.resume(Unit)
              }

              override fun onCharacteristicWrite(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                status: Int
              ) {
                val pending = bleWriteContinuation ?: return
                bleWriteContinuation = null
                if (status == BluetoothGatt.GATT_SUCCESS) pending.resume(Unit)
                else pending.resumeWithException(
                  IllegalStateException("O ESP32 não confirmou o envio Bluetooth (código $status).")
                )
              }
            }
            try {
              bleGatt = adapter.getRemoteDevice(address)
                .connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
                ?: throw IllegalStateException("Não foi possível iniciar a conexão Bluetooth com o ESP32.")
            } catch (error: SecurityException) {
              throw IllegalStateException("Permita o acesso a dispositivos próximos para conectar ao ESP32.", error)
            }
            continuation.invokeOnCancellation { disconnectBle() }
          }
        }
      } catch (error: Throwable) {
        disconnectBle()
        if (error is kotlinx.coroutines.TimeoutCancellationException) {
          throw IllegalStateException("Tempo esgotado ao conectar por Bluetooth. Tente buscar o ESP32 novamente.")
        }
        throw error
      }
    }

    AsyncFunction("provisionBleDeviceAsync") Coroutine { ssid: String, password: String, credential: String ->
      if (bleGatt == null || bleCommandCharacteristic == null) {
        throw IllegalStateException("Conecte-se primeiro ao ESP32 por Bluetooth.")
      }
      writeBleCommand("SSID=$ssid")
      writeBleCommand("PASSWORD=$password")
      if (credential.isNotEmpty()) writeBleCommand("CREDENTIAL=$credential")
      writeBleCommand("SAVE")
    }

    AsyncFunction("disconnectDeviceAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      disconnect(context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager)
    }

    AsyncFunction("disconnectBleDeviceAsync") {
      disconnectBle()
    }
  }

  private fun bluetoothAdapter(context: Context) =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      ?: throw IllegalStateException("O Bluetooth não está disponível neste aparelho.")

  private fun requireBluetoothPermission(context: Context, permission: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED
    ) {
      throw SecurityException("Permita o acesso a dispositivos próximos para usar o Bluetooth.")
    }
  }

  private fun failBleConnect(error: Throwable) {
    val continuation = bleConnectContinuation ?: return
    bleConnectContinuation = null
    if (continuation.isActive) continuation.resumeWithException(error)
  }

  private suspend fun writeBleCommand(command: String) {
    val gatt = bleGatt ?: throw IllegalStateException("Conecte-se primeiro ao ESP32 por Bluetooth.")
    val characteristic = bleCommandCharacteristic
      ?: throw IllegalStateException("O serviço de configuração BLE não está disponível.")
    val value = command.toByteArray(Charsets.UTF_8)
    if (value.size > 182) throw IllegalArgumentException("Os dados enviados ao ESP32 excedem o limite Bluetooth.")

    try {
      withTimeout(12_000) {
        suspendCancellableCoroutine<Unit> { continuation ->
          bleWriteContinuation = continuation
          val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeCharacteristic(
              characteristic,
              value,
              BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            ) == BluetoothGatt.GATT_SUCCESS
          } else {
            @Suppress("DEPRECATION")
            characteristic.value = value
            @Suppress("DEPRECATION")
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            @Suppress("DEPRECATION")
            gatt.writeCharacteristic(characteristic)
          }
          if (!started) {
            bleWriteContinuation = null
            continuation.resumeWithException(IllegalStateException("Não foi possível enviar os dados ao ESP32 por Bluetooth."))
          }
          continuation.invokeOnCancellation { bleWriteContinuation = null }
        }
      }
    } catch (error: kotlinx.coroutines.TimeoutCancellationException) {
      bleWriteContinuation = null
      throw IllegalStateException("Tempo esgotado ao enviar a configuração por Bluetooth.", error)
    }
  }

  private fun disconnectBle() {
    bleConnectContinuation?.cancel()
    bleConnectContinuation = null
    bleWriteContinuation?.cancel()
    bleWriteContinuation = null
    bleCommandCharacteristic = null
    bleGatt?.let { gatt ->
      runCatching { gatt.disconnect() }
      runCatching { gatt.close() }
    }
    bleGatt = null
  }

  private fun disconnect(connectivity: ConnectivityManager) {
    val callback = deviceCallback
    deviceCallback = null
    deviceNetwork = null
    callback?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
  }
}
