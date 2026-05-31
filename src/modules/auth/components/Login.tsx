import React from 'react';
import { Mail, Lock, Globe, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLogin: (email: string, pass: string) => void;
  onRegister: (email: string, pass: string) => void;
  onForgotPassword: (email: string) => Promise<boolean>;
  loading: boolean;
  error?: any;
}

export default function Login({ onLogin, loading, error }: LoginProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showResetModal, setShowResetModal] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 bg-slate-900">
        <img 
          src="https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=2670&auto=format&fit=crop" 
          alt="Technical Background" 
          className="w-full h-full object-cover scale-110 blur-[1px] opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark/95 via-black/80 to-brand-red/30" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-20 grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        
        {/* Left Side: Welcome Text */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block space-y-8"
        >
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 shadow-inner">
              <Globe className="text-white" size={18} />
            </div>
            <span className="text-white/90 font-black text-xs tracking-[0.2em] uppercase">CANTV Datos</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-6xl lg:text-7xl font-display font-black text-white leading-[1.1] tracking-tight whitespace-pre-line">
              {'Bienvenido\nde Nuevo'}
            </h1>
            <p className="text-white/70 text-xl max-w-md leading-relaxed font-medium italic border-l-2 border-brand-red/50 pl-4">
              "Conectando a Venezuela con precisión técnica desde la Central 4357."
            </p>
          </div>
        </motion.div>

        {/* Right Side: Login Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto lg:mx-0 relative"
        >
          {showResetModal && (
             <div className="absolute inset-0 z-50 flex items-center justify-center w-full h-full pb-8">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[40px]"></div>
                <div className="relative z-10 bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl m-6 text-center animate-in zoom-in-95 fade-in duration-200">
                  <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                  <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20">
                    <AlertCircle className="text-amber-500" size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight mb-2">Restablecimiento Restringido</h3>
                  <p className="text-sm font-medium text-slate-300 leading-relaxed mb-6">
                    Para restablecer tus credenciales de acceso, comunícate con el Administrador General del departamento.
                  </p>
                  <button 
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors"
                  >
                    Entendido
                  </button>
                </div>
             </div>
          )}

          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 lg:p-12 rounded-[32px] sm:rounded-[40px] shadow-2xl relative overflow-hidden group">
            {/* Subtle light effect */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-blue/20 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <header className="mb-8 sm:mb-10 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start lg:hidden mb-8">
                  <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 mb-3 shadow-inner">
                    <Globe className="text-white" size={18} />
                  </div>
                  <span className="text-white/90 font-black text-[10px] tracking-[0.2em] uppercase">CANTV Datos</span>
                </div>
                <div className="inline-block text-left relative">
                  <h2 className="text-3xl font-display font-black text-white tracking-tight mb-2">
                    Iniciar Sesión
                  </h2>
                  <div className="h-1.5 w-full bg-brand-red rounded-full" />
                </div>
              </header>

              <form onSubmit={handleSubmit} className="space-y-6">
                {(error) && (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-xs text-red-100 font-medium italic animate-in fade-in duration-200">
                    {error.message || 'Ocurrió un error. Verifica tus datos e intenta de nuevo.'}
                  </div>
                )}

                <div className="space-y-5">
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-black text-white/50 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 focus:bg-white/10 focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent outline-none transition-all text-white rounded-2xl shadow-inner shadow-black/20 font-medium"
                        placeholder="ejemplo@cantv.com.ve"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-black text-white/50 uppercase tracking-widest ml-1">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                      <input
                        required
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 focus:bg-white/10 focus:ring-2 focus:ring-brand-blue/50 focus:border-transparent outline-none transition-all text-white rounded-2xl shadow-inner shadow-black/20 font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group text-white/50 hover:text-white transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-black/40 text-brand-blue focus:ring-brand-blue/20" />
                    <span className="text-xs font-medium">Recordarme</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setShowResetModal(true)}
                    className="text-xs text-white/40 hover:text-white underline underline-offset-4 transition-colors font-bold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-brand-blue text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-brand-blue-dark transition-all shadow-xl shadow-brand-blue/30 disabled:opacity-50 active:scale-[0.98] mt-2"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <span>Ingresar</span>
                  )}
                </button>

                <div className="pt-8 mt-4 border-t border-white/10 text-center px-4">
                  <p className="text-[9px] text-white/40 leading-relaxed font-bold uppercase tracking-widest">
                    Uso estrictamente confidencial y autorizado para personal de CANTV.
                  </p>
                  <p className="text-[8px] text-white/20 mt-3 font-bold tracking-widest uppercase">
                    Gerencia Gral. de Tecnología y Operaciones<br />
                    © {new Date().getFullYear()} Compañía Anónima Nacional<br/>Teléfonos de Venezuela
                  </p>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


