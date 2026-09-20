import { useEffect, useState } from 'react';
import { Bluetooth, Radio, ShieldCheck } from 'lucide-react';
import BleProvisioning from '@/components/provisioning/BleProvisioning';
import ApProvisioning from '@/components/provisioning/ApProvisioning';
import { mqttManager } from '@/lib/mqttClients';

function StatusIndicator({ label, online, pending = false }) {
  const color = online ? 'bg-emerald-500' : pending ? 'bg-amber-400' : 'bg-slate-300';
  const text = online ? 'Conectado' : pending ? 'Conectando...' : 'Desconectado';

  return <div className="flex items-center gap-3"><span className={`h-3 w-3 shrink-0 rounded-full ring-4 ring-slate-100 ${color} ${pending ? 'animate-pulse' : ''}`} /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</p><p className="text-sm font-semibold text-slate-950">{text}</p></div></div>;
}

export default function ConexaoEsp32() {
  const [mode, setMode] = useState('ble');
  const [espConnected, setEspConnected] = useState(false);
  const [brokerStatus, setBrokerStatus] = useState(mqttManager.status);

  useEffect(() => {
    const unsubscribe = mqttManager.onStatus(setBrokerStatus);
    mqttManager.connect();
    return unsubscribe;
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:py-12">
      <div className="mx-auto max-w-xl">
        <header className="mb-7 flex items-start gap-4">
          <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-lg shadow-slate-900/10">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950">Conectar dispositivo</h1>
            <p className="mt-2 max-w-md text-base leading-6 text-slate-600">
                Escolha o método de conexão e envie as credenciais da sua rede Wi-Fi.
            </p>
          </div>
        </header>
        <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <StatusIndicator 
            label="Dispositivo" online={espConnected} 
        />
        <StatusIndicator 
            label="Broker MQTT" online={brokerStatus === 'connected'} 
            pending={['connecting', 'reconnecting'].includes(brokerStatus)} 
        />
        </div>
        <div className="mb-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
             role="tablist" 
             aria-label="Método de conexão">
        <button 
            type="button"
            role="tab" 
            aria-selected={mode === 'ble'} 
            onClick={() => setMode('ble')} 
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold leading-tight transition-colors 
            ${mode === 'ble' ? 'bg-sky-700 text-white shadow-md shadow-sky-700/20' : 'text-slate-700 hover:bg-slate-100'}`}>
            <Bluetooth className="h-4 w-4 shrink-0" />
            Bluetooth
        </button>
        <button 
            type="button" 
            role="tab" 
            aria-selected={mode === 'ap'} 
            onClick={() => setMode('ap')} 
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold leading-tight 
            transition-colors ${mode === 'ap' ? 'bg-sky-700 text-white shadow-md shadow-sky-700/20' : 'text-slate-700 hover:bg-slate-100'}`}>
        <Radio className="h-4 w-4 shrink-0" />Ponto de acesso</button>
    </div>
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-7">
          {mode === 'ble' ? 
          <BleProvisioning 
          onSuccess={() => {}} 
          onConnectionChange={setEspConnected} 
          />
        : <ApProvisioning 
            onSuccess={() => {}} 
            onConnectionChange={setEspConnected} />}
        </section>
        <p className="mt-5 text-center text-sm text-slate-600">Mantenha o dispositivo ligado e próximo do celular durante a configuração.</p>
      </div>
    </main>
  );
}
