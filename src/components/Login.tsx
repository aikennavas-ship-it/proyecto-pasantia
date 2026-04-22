import React from 'react';
import { Mail, Lock, ArrowRight, Facebook, Twitter, Instagram, Youtube, Globe, UserPlus, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLogin: (email: string, pass: string) => void;
  onRegister: (email: string, pass: string) => void;
  onForgotPassword: (email: string) => void;
  loading: boolean;
  error?: any;
}

export default function Login({ onLogin, onRegister, onForgotPassword, loading, error }: LoginProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [isForgotPassword, setIsForgotPassword] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      onForgotPassword(email);
    } else if (isRegistering) {
      onRegister(email, password);
    } else {
      onLogin(email, password);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=2670&auto=format&fit=crop" 
          alt="Technical Background" 
          className="w-full h-full object-cover scale-110 blur-[1px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark/90 via-black/70 to-brand-red/20" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-20 grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        
        {/* Left Side: Welcome Text */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block space-y-8"
        >
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/30">
              <Globe className="text-white" size={20} />
            </div>
            <span className="text-white font-bold text-lg tracking-widest uppercase">CANTV Datos</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-7xl lg:text-8xl font-display font-black text-white leading-[0.9] tracking-tighter whitespace-pre-line">
              {isForgotPassword ? 'Restablecer\nAcceso' : isRegistering ? 'Registro de\nPersonal' : 'Bienvenido de\nNuevo'}
            </h1>
            <p className="text-white/80 text-xl max-w-sm leading-relaxed font-medium italic">
              "Conectando a Venezuela con precisión técnica desde la Central 4357."
            </p>
          </div>

          <div className="flex gap-6 items-center pt-8">
            <button className="text-white/60 hover:text-white transition-colors"><Facebook size={20} /></button>
            <button className="text-white/60 hover:text-white transition-colors"><Twitter size={20} /></button>
            <button className="text-white/60 hover:text-white transition-colors"><Instagram size={20} /></button>
            <button className="text-white/60 hover:text-white transition-colors"><Youtube size={20} /></button>
          </div>
        </motion.div>

        {/* Right Side: Login Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto lg:mx-0"
        >
          <div className="bg-black/20 backdrop-blur-3xl border border-white/10 p-8 lg:p-12 rounded-[40px] shadow-2xl relative overflow-hidden group">
            {/* Subtle light effect */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-blue/20 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <header className="mb-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isForgotPassword ? 'forgot' : isRegistering ? 'reg' : 'log'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                      <h2 className="text-3xl font-display font-black text-white tracking-tight mb-2">
                         {isForgotPassword ? 'Contraseña' : isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
                      </h2>
                      <div className="h-1.5 w-12 bg-brand-red rounded-full" />
                  </motion.div>
                </AnimatePresence>
              </header>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-xs text-red-100 font-medium italic">
                    {error.message || 'Ocurrió un error. Verifica tus datos e intenta de nuevo.'}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1 group">
                    <label className="text-[11px] font-black text-white/50 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/95 border-transparent focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-slate-900 rounded-2xl shadow-inner shadow-black/5 font-medium"
                        placeholder="ejemplo@cantv.com.ve"
                      />
                    </div>
                  </div>

                  {!isForgotPassword && (
                    <div className="space-y-1 group">
                      <label className="text-[11px] font-black text-white/50 uppercase tracking-widest ml-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                        <input
                          required
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-white/95 border-transparent focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-slate-900 rounded-2xl shadow-inner shadow-black/5 font-medium"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {!isForgotPassword && (
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 cursor-pointer group text-white/60 hover:text-white transition-colors">
                      <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-black/40 text-brand-blue focus:ring-brand-blue/20" />
                      <span className="text-xs font-medium">Recordarme</span>
                    </label>
                    {!isRegistering && (
                      <button 
                        type="button" 
                        onClick={() => setIsForgotPassword(true)}
                        className="text-xs text-white/60 hover:text-white underline underline-offset-4 transition-colors font-bold"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-brand-blue text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-brand-blue-dark transition-all shadow-xl shadow-brand-blue/30 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                      <span>Cargando...</span>
                    </div>
                  ) : (
                    <span>{isForgotPassword ? 'Restablecer' : isRegistering ? 'Registrar' : 'Ingresar'}</span>
                  )}
                </button>

                <div className="pt-4 text-center space-y-3">
                  {isForgotPassword ? (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 mx-auto group transition-colors"
                    >
                      <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> Volver al inicio
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 mx-auto group transition-colors"
                    >
                      {isRegistering ? (
                        <><LogIn size={14} className="group-hover:-translate-x-1 transition-transform" /> Ya tengo cuenta</>
                      ) : (
                        <><UserPlus size={14} className="group-hover:translate-y-1 transition-transform" /> Crear una nueva cuenta</>
                      )}
                    </button>
                  )}
                </div>

                <div className="pt-8 border-t border-white/5 text-center">
                  <p className="text-[10px] text-white/40 leading-relaxed max-w-xs mx-auto">
                    Al acceder aceptas nuestras políticas <br />
                    <button type="button" className="hover:text-white/60 underline">Términos de Servicio</button> | <button type="button" className="hover:text-white/60 underline">Política de Privacidad</button>
                  </p>
                </div>
              </form>
            </div>
          </div>
          
          <div className="mt-8 lg:hidden text-center">
             <span className="text-white font-bold text-sm tracking-widest uppercase opacity-50">CANTV Datos</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


