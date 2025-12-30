import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  color?: string;
  analyser?: AnalyserNode | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, color = '#f59e0b', analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.offsetWidth || 300;
    canvas.height = canvas.parentElement?.offsetHeight || 100;

    const bars = 40;
    const barWidth = canvas.width / bars;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : bars);
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
        }

        for (let i = 0; i < bars; i++) {
          let height;
          if (analyser) {
            // Map frequency data to bar height
            const value = dataArray[i * Math.floor(dataArray.length / bars)];
            height = (value / 255) * canvas.height * 0.9;
          } else {
            // Fallback random
            height = Math.random() * (canvas.height * 0.8);
          }
          
          const x = i * barWidth;
          const y = (canvas.height - height) / 2;
          
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.roundRect(x + 1, y, barWidth - 3, height, 4);
          ctx.fill();
        }
      } else {
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
  }, [isPlaying, color, analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-lg"
    />
  );
};