import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { INGREDIENTS, shadeColor } from '../data/ingredients';

export interface ParticleHandle {
  spawnDragRain: (
    colIndex: number,
    barTopX: number,
    barTopY: number,
    isIncreasing: boolean,
    trackWidth: number
  ) => void;
  onRelease: (
    colIndex: number,
    barTopX: number,
    barTopY: number,
    didIncrease: boolean,
    trackWidth: number
  ) => void;
}

interface CubeParticle {
  id: number;
  colIndex: number;
  startX: number;
  startY: number;
  size: number;
  topColor: string;
  leftColor: string;
  rightColor: string;
  targetDx: number;
  targetDy: number;
  rot: number;
  delay: number;
  duration: number;
  isConverging?: boolean;
  convergeTargetX?: number;
  convergeTargetY?: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const ParticleLayer = forwardRef<ParticleHandle>((_props, ref) => {
  const [particles, setParticles] = useState<CubeParticle[]>([]);
  const idRef = useRef(0);
  const particlesRef = useRef<CubeParticle[]>([]);
  particlesRef.current = particles;

  // 12px 드래그마다 2~3개 큐브 우수수 생성
  const spawnDragRain = useCallback(
    (
      colIndex: number,
      barTopX: number,
      barTopY: number,
      isIncreasing: boolean,
      trackWidth: number
    ) => {
      const current = particlesRef.current;
      // 화면 전체 최대 60개
      if (current.length >= 60) return;
      // 열당 동시 최대 24개
      const colActive = current.filter((p) => p.colIndex === colIndex && !p.isConverging);
      if (colActive.length >= 24) return;

      const ing = INGREDIENTS[colIndex];
      if (!ing) return;

      const baseColor = ing.color;
      const topColor = shadeColor(baseColor, 0.12);
      const leftColor = baseColor;
      const rightColor = shadeColor(baseColor, -0.14);

      // 생성량: 2~3개
      const batchCount = Math.floor(rand(2, 3.99));
      const newBatch: CubeParticle[] = [];

      for (let k = 0; k < batchCount; k++) {
        if (current.length + newBatch.length >= 60) break;
        if (colActive.length + newBatch.length >= 24) break;

        // 크기: 바 폭의 18%~35%
        const size = trackWidth * rand(0.18, 0.35);

        let startX = barTopX;
        let startY = barTopY;
        let targetDx = 0;
        let targetDy = 0;

        if (isIncreasing) {
          // 칸을 늘리는 중 (위로 드래그):
          // 시작점: 바 윗면 위 40~90px, 좌우 ±(바 폭의 60%) 범위에서 랜덤
          // 낙하: 바 윗면 근처로 우수수 떨어져 내려와 쌓이듯 사라짐
          const dropDistance = rand(40, 90);
          startX = barTopX + rand(-trackWidth * 0.6, trackWidth * 0.6);
          startY = barTopY - dropDistance;
          targetDx = rand(-12, 12);
          targetDy = dropDistance + rand(-5, 10);
        } else {
          // 칸을 줄이는 중 (아래로 드래그):
          // 시작점: 바 윗면 근처
          // 흘러내림: 아래로 40~90px 낙하, 좌우 ±30px 퍼짐
          startX = barTopX + rand(-trackWidth * 0.3, trackWidth * 0.3);
          startY = barTopY + rand(-8, 8);
          targetDx = rand(-30, 30);
          targetDy = rand(40, 90);
        }

        const rot = rand(-30, 30);
        // 0~200ms 랜덤 지연으로 우수수 쏟아지는 느낌
        const delay = Math.round(rand(0, 200));
        // 나타나기 100ms -> 900~1400ms 동안 천천히 사라짐
        const duration = 100 + rand(900, 1400);

        const id = ++idRef.current;
        newBatch.push({
          id,
          colIndex,
          startX,
          startY,
          size,
          topColor,
          leftColor,
          rightColor,
          targetDx,
          targetDy,
          rot,
          delay,
          duration,
        });

        // DOM에서 반드시 제거하여 개수 상한 유지 및 성능 확보
        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== id));
        }, delay + duration + 40);
      }

      if (newBatch.length > 0) {
        setParticles((prev) => [...prev, ...newBatch]);
      }
    },
    []
  );

  // 손을 뗄 때: 남은 입자가 바 윗면 중앙으로 500ms ease-in-out으로 모이며 사라짐 + 튀어오르는 큐브 2~3개 (700ms)
  const onRelease = useCallback(
    (
      colIndex: number,
      barTopX: number,
      barTopY: number,
      didIncrease: boolean,
      trackWidth: number
    ) => {
      // 1. 남은 입자가 바 윗면 중앙으로 모이며 사라짐
      setParticles((prev) =>
        prev.map((p) => {
          if (p.colIndex === colIndex && !p.isConverging) {
            return {
              ...p,
              isConverging: true,
              convergeTargetX: barTopX - p.size / 2,
              convergeTargetY: barTopY - p.size / 2,
            };
          }
          return p;
        })
      );

      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !(p.colIndex === colIndex && p.isConverging)));
      }, 520);

      // 2. 증가한 경우 작고 느리게 튀어오르는 큐브 2~3개 (700ms)
      if (didIncrease) {
        const burstCount = Math.floor(rand(2, 3.99));
        const ing = INGREDIENTS[colIndex];
        if (!ing) return;

        const baseColor = ing.color;
        const topColor = shadeColor(baseColor, 0.12);
        const leftColor = baseColor;
        const rightColor = shadeColor(baseColor, -0.14);

        for (let k = 0; k < burstCount; k++) {
          const id = ++idRef.current;
          const size = trackWidth * rand(0.18, 0.24);
          const dx = rand(-16, 16);
          const dy = -rand(22, 42); // 살짝 떠오름
          const rot = rand(-20, 20);
          const duration = 700;

          const burstParticle: CubeParticle = {
            id,
            colIndex,
            startX: barTopX + rand(-10, 10),
            startY: barTopY + rand(-4, 4),
            size,
            topColor,
            leftColor,
            rightColor,
            targetDx: dx,
            targetDy: dy,
            rot,
            delay: k * 30,
            duration,
          };

          setParticles((prev) => [...prev, burstParticle]);
          setTimeout(() => {
            setParticles((prev) => prev.filter((p) => p.id !== id));
          }, burstParticle.delay + duration + 30);
        }
      }
    },
    []
  );

  useImperativeHandle(ref, () => ({
    spawnDragRain,
    onRelease,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {particles.map((p) => {
        if (p.isConverging && p.convergeTargetX !== undefined && p.convergeTargetY !== undefined) {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.startX - p.size / 2}px`,
                top: `${p.startY - p.size / 2}px`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: 'convergeFade 500ms ease-in-out forwards',
                ['--target-x' as string]: `${p.convergeTargetX - (p.startX - p.size / 2)}px`,
                ['--target-y' as string]: `${p.convergeTargetY - (p.startY - p.size / 2)}px`,
              }}
            >
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
                <polygon points="50,4 94,27 50,50 6,27" fill={p.topColor} />
                <polygon points="6,27 50,50 50,96 6,73" fill={p.leftColor} />
                <polygon points="50,50 94,27 94,73 50,96" fill={p.rightColor} />
              </svg>
            </div>
          );
        }

        const fadeInPercent = ((100 / p.duration) * 100).toFixed(2);

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.startX - p.size / 2}px`,
              top: `${p.startY - p.size / 2}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: 0,
              animation: `cubeRainFade ${p.duration}ms cubic-bezier(0.38, 0, 0.65, 1) ${p.delay}ms forwards`,
              ['--fadeInPct' as string]: `${fadeInPercent}%`,
              ['--dx' as string]: `${p.targetDx}px`,
              ['--dy' as string]: `${p.targetDy}px`,
              ['--rot' as string]: `${p.rot}deg`,
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
              <polygon points="50,4 94,27 50,50 6,27" fill={p.topColor} />
              <polygon points="6,27 50,50 50,96 6,73" fill={p.leftColor} />
              <polygon points="50,50 94,27 94,73 50,96" fill={p.rightColor} />
            </svg>
          </div>
        );
      })}

      <style>{`
        @keyframes cubeRainFade {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.6) rotate(0deg);
          }
          10% {
            opacity: 0.55;
            transform: translate(calc(var(--dx) * 0.1), calc(var(--dy) * 0.1)) scale(1) rotate(calc(var(--rot) * 0.1));
          }
          100% {
            opacity: 0;
            transform: translate(var(--dx), var(--dy)) scale(0.7) rotate(var(--rot));
          }
        }

        @keyframes convergeFade {
          0% {
            opacity: 0.5;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--target-x), var(--target-y)) scale(0.2);
          }
        }
      `}</style>
    </div>
  );
});

ParticleLayer.displayName = 'ParticleLayer';
