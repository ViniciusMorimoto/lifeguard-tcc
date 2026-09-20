import { useState } from 'react';
import { Wifi, CheckCircle2, XCircle, Loader2, Info, Radio, RefreshCw, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AP_IP = '192.168.4.1';

export default function ApProvisioning({ onSuccess, onConnectionChange }) {
  const [networks, setNetworks] = useState([]);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [password, setPassword] = useState('');
  const [scanStatus, setScanStatus] = useState('idle');
  const [provStatus, setProvStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [mac, setMac] = useState(null);

  const ssid = selectedSsid;
  const isScanning = scanStatus === 'scanning';
  const isProvisioning = provStatus === 'sending';
  const isSuccess = provStatus === 'success';
  const hasScanned = scanStatus === 'ready';

  const handleScan = async () => {
    setScanStatus('scanning');
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`http://${AP_IP}/scan`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const result = await response.json().catch(() => ({}));
      setNetworks(result.networks || []);
      setScanStatus('ready');
      onConnectionChange?.(true);
    } catch (err) {
      setScanStatus('error');
      setError(
        err.name === 'AbortError' || err.message.includes('Failed to fetch')
          ? `Não foi possível conectar ao dispositivo. Verifique se seu telefone está conectado à rede AP do dispositivo (${AP_IP}).`
          : err.message
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ssid) return;

    setProvStatus('sending');
    setError(null);

    try {
      const response = await fetch(`http://${AP_IP}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password }),
      });

      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

      const result = await response.json().catch(() => ({}));

      if (result.status === 'ok' || result.success || result.connected) {
        if (result.mac) setMac(result.mac);
        setProvStatus('success');
      } else if (result.status === 'fail' || result.error) {
        setProvStatus('failed');
        setError(result.error || result.message || 'O dispositivo não conseguiu conectar ao Wi-Fi');
      } else {
        if (result.mac) setMac(result.mac);
        setProvStatus('success');
      }
    } catch (err) {
      setProvStatus('error');
      setError(
        err.message.includes('Failed to fetch')
          ? `Não foi possível conectar ao dispositivo. Verifique se seu telefone está conectado à rede AP do dispositivo (${AP_IP}).`
          : err.message
      );
    }
  };

  if (isSuccess) {
    return (
      <div className="border border-chart-3/30 bg-chart-3/5 p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-chart-3 mx-auto mb-2" />
        <p className="font-mono text-xs text-foreground mb-3">Dispositivo conectado ao Wi-Fi com sucesso!</p>
        <Button onClick={() => onSuccess(mac)} variant="outline" className="font-mono text-xs">
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card p-3 flex items-center gap-2">
        <Radio className="w-4 h-4 text-chart-4" />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Provisionamento via Ponto de Acesso (AP)
        </span>
      </div>

      <div className="flex items-start gap-2 p-3 border border-chart-4/30 bg-chart-4/5">
        <Info className="w-3 h-3 text-chart-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            1. Coloque o dispositivo em modo AP (botão flash na inicialização ou comando serial).
          </p>
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            2. Nas configurações de Wi-Fi do seu telefone, conecte-se à rede <span className="text-chart-4">ESP32-SETUP-XXXX</span>.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            3. Volte ao app, escaneie as redes, escolha a sua e envie a senha.
          </p>
        </div>
      </div>

      {!hasScanned && (
        <Button
          onClick={handleScan}
          disabled={isScanning}
          className="min-h-12 w-full bg-slate-900 px-3 text-sm font-bold leading-tight text-white hover:bg-slate-700"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Escaneando redes…
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 mr-2" />
              Escanear Redes Próximas
            </>
          )}
        </Button>
      )}

      {hasScanned && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-mono text-[10px] uppercase tracking-wider">Redes Disponíveis</Label>
            <button
              onClick={handleScan}
              disabled={isProvisioning}
              className="font-mono text-[10px] text-chart-4 uppercase tracking-wider flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
          {networks.length === 0 ? (
            <div className="p-3 border border-border bg-card font-mono text-xs text-muted-foreground text-center">
              Nenhuma rede encontrada
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
              {networks.map((net, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSelectedSsid(net.ssid);
                  }}
                  className={`w-full flex items-center gap-2 p-2.5 border text-left transition-colors ${
                    selectedSsid === net.ssid
                      ? 'border-foreground bg-secondary'
                      : 'border-border bg-card hover:bg-secondary/50'
                  }`}
                >
                  <Signal className={`w-3.5 h-3.5 ${selectedSsid === net.ssid ? 'text-foreground' : 'text-muted-foreground'}`} />
                  <span className="font-mono text-xs flex-1 truncate">{net.ssid}</span>
                  {net.rssi != null && (
                    <span className="font-mono text-[10px] text-muted-foreground">{net.rssi}dBm</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="font-mono text-[10px] uppercase tracking-wider">Ou digite o SSID</Label>
          <Input value={ssid} readOnly placeholder="Escolha uma rede acima" disabled={isProvisioning} className="font-mono text-sm bg-slate-50" />
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-[10px] uppercase tracking-wider">Senha Wi-Fi</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha da rede"
            disabled={isProvisioning}
            className="font-mono text-sm"
          />
        </div>

        {isProvisioning && (
          <div className="flex items-center gap-2 p-3 border border-border bg-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-chart-4" />
            <span className="font-mono text-xs text-muted-foreground">Enviando credenciais para {AP_IP}…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 border border-destructive/30 bg-destructive/5">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="font-mono text-xs text-destructive">{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={isProvisioning || !ssid}
          className="min-h-12 w-full bg-slate-900 px-3 text-sm font-bold leading-tight text-white hover:bg-slate-700"
        >
          <Wifi className="w-4 h-4 mr-2" />
          {isProvisioning ? 'Enviando…' : 'Enviar Credenciais'}
        </Button>
      </form>
    </div>
  );
}