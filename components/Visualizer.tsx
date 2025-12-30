import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  color?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, color = '#f59e0b' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.parentElement?.offsetWidth || 300;
    canvas.height = canvas.parentElement?.offsetHeight || 100;

    let bars = 50;
    const barWidth = canvas.width / bars;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        for (let i = 0; i < bars; i++) {
          // Generate pseudo-random heights to simulate voice activity
          const height = Math.random() * (canvas.height * 0.8);
          const x = i * barWidth;
          const y = (canvas.height - height) / 2;
          
          ctx.fillStyle = color;
          // Add some transparency for glass look
          ctx.globalAlpha = 0.6;
          ctx.fillRect(x, y, barWidth - 2, height);
        }
      } else {
         // Flat line when idle
         ctx.fillStyle = color;
         ctx.globalAlpha = 0.2;
         ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, color]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-lg"
    />
  );
};