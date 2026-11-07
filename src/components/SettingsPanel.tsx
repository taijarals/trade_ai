import React, { useState, useEffect } from 'react';
import { Config, Preset } from '../types';
import { SUPPORTED_MARKETS } from '../services/foxbit';
import { getAllPresets, savePresets } from '../services/storage';
import { Sliders, Save, Download, Upload, Plus, Trash2, Check } from 'lucide-react';

interface SettingsPanelProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, setConfig }) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    getAllPresets().then(setPresets).catch(console.error);
  }, []);

  const handleChange = (key: keyof Config, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: Preset) => {
    setConfig(prev => ({
      ...prev,
      ...preset.config
    }));
  };

  const handleSaveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || 'Conjunto personalizado.',
      config: { ...config }
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setNewPresetName('');
    setNewPresetDesc('');
    setShowSaveModal(false);
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  };

  const exportPresetsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(presets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `presets_robo_tendencia_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importPresetsJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            setPresets(parsed);
            savePresets(parsed);
          }
        } catch (err) {
          alert('Arquivo JSON inválido.');
        }
      };
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Presets Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Conjuntos Prontos (Presets) & Configurações
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Escolha um perfil de risco pronto ou ajuste todos os parâmetros do laboratório.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              Salvar Atual como Preset
            </button>
            <button
              onClick={exportPresetsJSON}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              Exportar JSON
            </button>
            <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer">
              <Upload className="w-4 h-4" />
              Importar JSON
              <input type="file" accept=".json" onChange={importPresetsJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* Preset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {presets.map(preset => (
            <div
              key={preset.id}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-indigo-500 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{preset.name}</h3>
                  {!preset.isDefault && (
                    <button onClick={() => deletePreset(preset.id)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
              </div>

              <button
                onClick={() => applyPreset(preset)}
                className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar Preset
              </button>
            </div>
          ))}
        </div>

        {showSaveModal && (
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl space-y-3 border border-slate-300 dark:border-slate-700">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Salvar Configuração Atual como Novo Preset</h4>
            <input
              type="text"
              placeholder="Nome do Preset (ex: Conservador Plus)"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            />
            <input
              type="text"
              placeholder="Breve descrição"
              value={newPresetDesc}
              onChange={e => setNewPresetDesc(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400">Cancelar</button>
              <button onClick={handleSaveCurrentAsPreset} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold">Salvar</button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Configuration Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market & Mode */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Mercado & Modo de Execução</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mercado Foxbit</label>
              <select
                value={config.market}
                onChange={e => handleChange('market', e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
              >
                {SUPPORTED_MARKETS.map(m => (
                  <option key={m.symbol} value={m.symbol}>{m.displayName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Resolução (Candles)</label>
                <select
                  value={config.resolution}
                  onChange={e => handleChange('resolution', e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="1m">1 minuto</option>
                  <option value="5m">5 minutos</option>
                  <option value="15m">15 minutos</option>
                  <option value="30m">30 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="1d">1 dia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Modo</label>
                <select
                  value={config.mode}
                  onChange={e => handleChange('mode', e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="replay">Modo Replay</option>
                  <option value="live">Modo Ao Vivo</option>
                </select>
              </div>
            </div>

            {config.mode === 'replay' && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Data do Replay</label>
                  <input
                    type="date"
                    value={config.replayDate}
                    onChange={e => handleChange('replayDate', e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                  />
                  {new Date().getTime() - new Date(config.replayDate).getTime() > 180 * 86400000 && (
                    <p className="text-xs text-amber-500 mt-1">⚠️ Data com mais de 6 meses. A IA pode lembrar de eventos históricos. Recomenda-se dias recentes.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Início (Brasília)</label>
                    <input
                      type="time"
                      value={config.replayStartTime}
                      onChange={e => handleChange('replayStartTime', e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fim (Brasília)</label>
                    <input
                      type="time"
                      value={config.replayEndTime}
                      onChange={e => handleChange('replayEndTime', e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Atraso entre passos (ms)</label>
                  <input
                    type="number"
                    value={config.replayDelayMs}
                    onChange={e => handleChange('replayDelayMs', Number(e.target.value))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Capital & Costs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Capital & Custos Operacionais</h3>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Capital Inicial (R$)</label>
                <input
                  type="number"
                  value={config.initialCapitalBRL}
                  onChange={e => handleChange('initialCapitalBRL', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Moedas Iniciais</label>
                <input
                  type="number"
                  value={config.initialCoins}
                  onChange={e => handleChange('initialCoins', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Taxa por Ordem (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.feePercent}
                  onChange={e => handleChange('feePercent', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Slippage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.slippagePercent}
                  onChange={e => handleChange('slippagePercent', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mín. por Ordem (R$)</label>
                <input
                  type="number"
                  value={config.minOrderValueBRL}
                  onChange={e => handleChange('minOrderValueBRL', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Modo de Tamanho da Compra</label>
                <select
                  value={config.buySizeMode}
                  onChange={e => handleChange('buySizeMode', e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="percent">% do Saldo em Reais</option>
                  <option value="fixed">Valor Fixo em Reais (R$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Valor / Percentual da Compra</label>
                <input
                  type="number"
                  value={config.buySizeValue}
                  onChange={e => handleChange('buySizeValue', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI & Strategy Rules */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Inteligência Artificial & Limiares</h3>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Modelo Gemini</label>
                <select
                  value={config.geminiModel}
                  onChange={e => handleChange('geminiModel', e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Temperatura (0 - 1)</label>
                <input
                  type="number"
                  step="0.05"
                  max="1"
                  min="0"
                  value={config.temperature}
                  onChange={e => handleChange('temperature', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Janela de Candles</label>
                <input
                  type="number"
                  value={config.candleWindowSize}
                  onChange={e => handleChange('candleWindowSize', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Horizonte H (Candles)</label>
                <input
                  type="number"
                  value={config.predictionHorizon}
                  onChange={e => handleChange('predictionHorizon', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Limiar de Compra (%)</label>
                <input
                  type="number"
                  value={config.buyThreshold}
                  onChange={e => handleChange('buyThreshold', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Limiar de Queda (%)</label>
                <input
                  type="number"
                  value={config.sellThreshold}
                  onChange={e => handleChange('sellThreshold', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Anonimizar dados para a IA</span>
              <input
                type="checkbox"
                checked={config.anonymized}
                onChange={e => handleChange('anonymized', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Risk Management & Guardrails */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Gerenciamento de Risco & Travas</h3>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Meta de Ganho (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.gainTargetPercent}
                  onChange={e => handleChange('gainTargetPercent', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.stopLossPercent ?? 0}
                  onChange={e => handleChange('stopLossPercent', Number(e.target.value) || null)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Espera após Compra (passos)</label>
                <input
                  type="number"
                  value={config.cooldownSteps}
                  onChange={e => handleChange('cooldownSteps', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Máx. Lotes Abertos</label>
                <input
                  type="number"
                  value={config.maxActiveLots}
                  onChange={e => handleChange('maxActiveLots', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Máx. Operações/Dia</label>
                <input
                  type="number"
                  value={config.maxDailyTrades}
                  onChange={e => handleChange('maxDailyTrades', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Trava Geral de Perda (%)</label>
                <input
                  type="number"
                  value={config.generalGuardrailPercent}
                  onChange={e => handleChange('generalGuardrailPercent', Number(e.target.value))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ação ao Acionar Trava</label>
                <select
                  value={config.guardrailAction}
                  onChange={e => handleChange('guardrailAction', e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="stop">Apenas Parar de Operar</option>
                  <option value="sell_all">Vender Todos os Lotes & Parar</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
