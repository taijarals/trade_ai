import React, { useState, useEffect } from 'react';
import { SessionRecord } from '../types';
import { getAllSessions, deleteSession, saveSession } from '../services/storage';
import { History, Trash2, Eye, FileText, Check, ArrowRight } from 'lucide-react';

interface SessionsPanelProps {
  onLoadSession: (session: SessionRecord) => void;
  onCompareSessions: (sessions: SessionRecord[]) => void;
}

export const SessionsPanel: React.FC<SessionsPanelProps> = ({ onLoadSession, onCompareSessions }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const data = await getAllSessions();
      // Sort descending by date
      data.sort((a, b) => b.createdAt - a.createdAt);
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja realmente excluir esta sessão salva?')) {
      await deleteSession(id);
      loadAll();
    }
  };

  const toggleSelectForComparison = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      if (selectedIds.length >= 3) {
        alert('Você pode comparar no máximo 3 sessões simultaneamente.');
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSaveNotes = async (session: SessionRecord) => {
    const updated = { ...session, notes: notesText };
    await saveSession(updated);
    setEditingNotesId(null);
    loadAll();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sessões & Histórico de Simulações</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Revise simulações passadas, adicione notas ou compare até 3 sessões lado a lado.</p>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                const selected = sessions.filter(s => selectedIds.includes(s.id));
                onCompareSessions(selected);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
            >
              Comparar {selectedIds.length} Sessões Selecionadas
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhuma sessão salva encontrada. Execute uma simulação para salvá-la no histórico.
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => {
              const isSelected = selectedIds.includes(session.id);
              const returnVal = Number(session.totalReturnPercent || 0);
              const isPositive = returnVal >= 0;

              return (
                <div
                  key={session.id}
                  onClick={() => toggleSelectForComparison(session.id)}
                  className={`bg-slate-50 dark:bg-slate-800/60 border rounded-xl p-5 cursor-pointer transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isSelected ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{session.title}</h3>
                      <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded uppercase font-medium">
                        {session.config.market}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Realizada em {new Date(session.createdAt).toLocaleString()} • {session.totalTrades} operações • {session.aiCallsCount} chamadas IA
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Retorno Total</div>
                      <div className={`font-bold text-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '+' : ''}R$ {Number(session.finalNetWorthBRL).toFixed(2)} ({isPositive ? '+' : ''}{returnVal.toFixed(2)}%)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadSession(session);
                        }}
                        title="Carregar Sessão"
                        className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        title="Excluir Sessão"
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
