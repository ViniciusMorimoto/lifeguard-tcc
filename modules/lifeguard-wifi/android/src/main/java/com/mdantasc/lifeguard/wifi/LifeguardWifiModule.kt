package com.mdantasc.lifeguard.wifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.net.wifi.WifiManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class LifeguardWifiModule : Module() {
  private var deviceNetwork: Network? = null
  private var deviceCallback: ConnectivityManager.NetworkCallback? = null

  override fun definition() = ModuleDefinition {
    Name("LifeguardWifi")

    AsyncFunction<List<Map<String, Any>>>("scanNetworksAsync") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        ?: throw IllegalStateException("O Wi-Fi não está disponível neste aparelho.")

      // Android disponibiliza imediatamente os últimos resultados e atualiza esse cache após a varredura.
      // Isso evita bloquear a tela enquanto o sistema faz a busca (que pode sofrer limitação de frequência).
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

    AsyncFunction("connectToDeviceAsync") { ssid: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw IllegalStateException("A configuração pelo aplicativo requer Android 10 ou superior.")
      }
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto do aplicativo não está disponível.")
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      disconnect(connectivity)
      val specifier = WifiNetworkSpecifier.Builder().setSsid(ssid).build()
      val request = NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        .setNetworkSpecifier(specifier)
        .build()
      suspendCancellableCoroutine { continuation ->
        val callback = object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            deviceNetwork = network
            deviceCallback = this
            connectivity.bindProcessToNetwork(network)
            if (continuation.isActive) continuation.resume(Unit)
          }
          override fun onUnavailable() {
            if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Não foi possível conectar ao ponto de acesso do ESP32."))
          }
        }
        deviceCallback = callback
        connectivity.requestNetwork(request, callback)
        continuation.invokeOnCancellation { disconnect(connectivity) }
      }
    }

    AsyncFunction("provisionDeviceAsync") { ssid: String, password: String, credential: String ->
      if (deviceNetwork == null) throw IllegalStateException("Conecte-se primeiro ao ponto de acesso do ESP32.")
      val body = listOf("ssid" to ssid, "password" to password, "credential" to credential)
        .joinToString("&") { (key, value) -> "${URLEncoder.encode(key, "UTF-8")}=${URLEncoder.encode(value, "UTF-8")}" }
      val connection = (URL("http://192.168.4.1/provision").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 12_000
        readTimeout = 12_000
        doOutput = true
        setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
      }
      try {
        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body) }
        if (connection.responseCode !in 200..299) throw IllegalStateException("O ESP32 recusou a configuração. Confira os dados e tente novamente.")
      } finally {
        connection.disconnect()
      }
    }

    AsyncFunction("disconnectDeviceAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction
      disconnect(context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager)
    }
  }

  private fun disconnect(connectivity: ConnectivityManager) {
    connectivity.bindProcessToNetwork(null)
    deviceCallback?.let { callback -> runCatching { connectivity.unregisterNetworkCallback(callback) } }
    deviceCallback = null
    deviceNetwork = null
  }
}
