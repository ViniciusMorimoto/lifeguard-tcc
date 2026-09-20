import { useState } from 'react';
import { Bluetooth, CheckCircle2, Loader2, RefreshCw, Signal, Wifi, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBleProvisioning } from '@/hooks/useBleProvisioning';

export default function BleProvisioning({ onSuccess, onConnectionChange }) {
  const { status, error, networks, mac, isSupported, connect, scanNetworks, provision, disconnect } = useBleProvisioning();
  const [selectedSsid, setSelectedSsid] = useState('');
  const [password, setPassword] = useState('');
  const connected = ['connected', 'scanning', 'ready'].includes(status);
  const busy = ['requesting', 'connecting', 'scanning', 'sending-ssid', 'sending-password', 'waiting'].includes(status);

  const handleProvision = async (event) => {
    event.preventDefault();
    if (selectedSsid) await provision(selectedSsid, password);
  };

  const handleConnect = async () => {
    const connectedNow = await connect();
    onConnectionChange?.(connectedNow);
  };

  const handleDisconnect = () => {
    disconnect();
    onConnectionChange?.(false);
  };

  if (!isSupported) return <p className="text-sm text-slate-500">Web Bluetooth não é suportado neste navegador. Use Chrome no Android ou o modo AP.</p>;

  if (status === 'success') {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" /><h2 className="font-heading text-lg font-semibold text-slate-900">Dispositivo conectado</h2><p className="mt-1 text-sm text-slate-600">As credenciais foram enviadas com sucesso.</p><Button onClick={() => onSuccess(mac)} className="mt-5 bg-slate-900">Continuar</Button></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl bg-sky-50 p-4">
        <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-100 p-2">
                <Bluetooth className="h-5 w-5 text-sky-700" />              
            </div>
                <div>
                    <h2 className="font-semibold text-slate-950">Bluetooth</h2>
                    <p className="text-sm text-slate-600">Conecte ao dispositivo antes de buscar redes</p>
                </div>
            </div>
                {connected && <span className="text-xs font-bold text-emerald-700">CONECTADO</span>}
        </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={handleConnect} disabled={busy || connected} variant="outline" className="min-h-12 border-2 border-slate-400 bg-white px-3 text-sm font-bold leading-tight text-slate-900 hover:bg-slate-100">
            {status === 'requesting' || status === 'connecting' ? 
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
            <Bluetooth className="mr-2 h-4 w-4" />}{connected ? 'Bluetooth conectado' : 'Conectar Bluetooth'}
        </Button>
        <Button onClick={() => scanNetworks()} 
                disabled={!connected || busy} 
                className="min-h-12 bg-slate-900 px-3 text-sm font-bold leading-tight text-white hover:bg-slate-700">
                    {status === 'scanning' ? 
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />: 
                    <RefreshCw className="mr-2 h-4 w-4" />}Escanear redes
        </Button>
    </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
            <Label>Redes Wi-Fi disponíveis</Label>
            <span className="text-xs text-slate-400">
                {networks.length} encontradas
            </span>
        </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {networks.length === 0 ? 
                <p 
                className="p-5 text-center text-sm text-slate-400">
                    Conecte o Bluetooth e escaneie as redes.
                </p> :
                networks.map((network, index) => <button key={`${network.ssid}-${network.rssi ?? 'unknown'}-${index}`} 
                type="button" 
                onClick={() => setSelectedSsid(network.ssid)}
                className={
                    `flex w-full items-center gap-3 rounded-lg border p-3 text-left 
                ${selectedSsid === network.ssid ? 
                'border-sky-500 bg-white shadow-sm' : 
                'border-transparent bg-white/60'
                }`}>
                <Signal className="h-4 w-4 text-sky-600" />
                <span className="flex-1 truncate text-sm text-slate-700">{network.ssid}
                </span>
                <span className="text-xs text-slate-400">
                    {network.rssi} dBm</span></button>)}
            </div>
        </div>
      <form 
        onSubmit={handleProvision}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-2">
            <Label htmlFor="ble-ssid">SSID selecionado</Label>
            <Input id="ble-ssid"
                    value={selectedSsid}
                    readOnly placeholder="Escolha uma rede acima" 
                    className="bg-slate-50" />
        </div>
            <div className="space-y-2">
                <Label htmlFor="ble-password">Senha da rede</Label>
                <Input 
                    id="ble-password" 
                    type="password" 
                    value={password} 
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite a senha Wi-Fi" 
                    disabled={busy} 
                />
            </div>
            <Button 
                type="submit" 
                disabled={!selectedSsid || busy}
                className="min-h-12 w-full bg-slate-900 text-sm font-bold leading-tight text-white hover:bg-slate-700">
                <Wifi className="mr-2 h-4 w-4" />
                {busy ? 'Enviando credenciais...' : 'Enviar credenciais'}
            </Button>
                {connected && <Button type="button" 
                onClick={handleDisconnect} 
                variant="ghost" 
                className="w-full 
                text-slate-500">
                Desconectar
            </Button>
            }
        </form>
      {error && 
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {error}
    </div>}
    </div>
  );
}
