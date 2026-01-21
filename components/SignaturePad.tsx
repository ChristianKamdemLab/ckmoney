
import React, { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  label: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Gestion intelligente du redimensionnement pour éviter le flou et les décalages
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
        if (!container || !canvas) return; // Double sécurité
        
        const ratio = Math.max(window.devicePixelRatio || 1, 2); // Force haute résolution (min x2)
        const width = container.offsetWidth;
        const height = container.offsetHeight;

        // Évite le redimensionnement si les dimensions sont à 0 ou si l'élément n'est pas encore visible
        if (width === 0 || height === 0) return;

        // On ne redimensionne que si ça change vraiment pour éviter d'effacer le dessin inutilement
        if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(ratio, ratio);
                ctx.strokeStyle = '#0f172a'; // slate-900
                ctx.lineWidth = 2.5; // Trait un peu plus épais pour meilleure lisibilité
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    };

    // Observer pour détecter quand la modale a fini de s'ouvrir/animer
    const resizeObserver = new ResizeObserver(() => {
        // Petit délai pour laisser l'animation CSS se terminer et éviter les crashs de rendu
        window.requestAnimationFrame(updateCanvasSize);
    });
    
    resizeObserver.observe(container);
    
    // Appel initial
    window.requestAnimationFrame(updateCanvasSize);

    return () => resizeObserver.disconnect();
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Empêcher le scroll sur mobile
    if (e.cancelable) e.preventDefault(); 
    e.stopPropagation();

    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        onSave(canvas.toDataURL());
      }
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onSave('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
        <button 
          type="button" 
          onClick={clear}
          className="text-slate-400 hover:text-red-500 transition-colors p-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
          title="Effacer"
        >
          <Eraser size={12} /> Effacer
        </button>
      </div>
      {/* Container agrandi (h-48 au lieu de h-32) et bordure plus visible */}
      <div ref={containerRef} className="relative h-48 w-full bg-slate-50 border-2 border-dashed border-slate-200 hover:border-slate-300 transition-colors rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ touchAction: 'none' }} // Crucial pour empêcher le scroll
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none block"
        />
        {!isDrawing && (
            <div className="absolute bottom-3 right-3 pointer-events-none opacity-30 text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded-md">
            Signez ici
            </div>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
