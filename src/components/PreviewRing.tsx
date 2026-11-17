import React, { useEffect, useRef, useState } from "react";

const C = 110;          // viewBox 220x220 중심
const R = 106;          // 바깥 반지름 (고정)
const RICE_DEG = 90;    // 밥 구간: 6시 ~ 9시 (고정)
const START_DEG = 270;  // 재료 시작: 9시 방향부터 시계방향
const CELL_DEG = (360 - RICE_DEG) / 8; // 1칸 = 33.75deg
const MAX_CELLS = 8;

// 0deg = 12시, 시계방향
const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const wedge = (a0: number, a1: number) => {
  const [x0, y0] = polar(a0, R);
  const [x1, y1] = polar(a1, R);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${C} ${C}L${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}Z`;
};

type Props = { counts: number[]; colors: string[]; fontSize?: number };

export default function PreviewRing({ counts, colors, fontSize = 38 }: Props) {
  const [shown, setShown] = useState<number[]>(counts);
  const targetRef = useRef<number[]>(counts);
  targetRef.current = counts;

  // 모든 재료가 같은 속도로 목표값에 수렴 → 이웃 호가 함께 움직여서 빈틈/튐 없음
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 32);
      last = t;
      setShown((prev) => {
        let moving = false;
        const next = prev.map((v, i) => {
          const goal = targetRef.current[i] ?? 0;
          const d = goal - v;
          if (Math.abs(d) < 0.002) return goal;
          moving = true;
          return v + d * (1 - Math.exp(-dt / 90));
        });
        return moving ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const totalShown = shown.reduce((a, b) => a + b, 0);
  const totalTarget = counts.reduce((a, b) => a + b, 0);

  // 가운데 원 반지름: 0칸=거의 꽉 참, 1칸≈98, 4칸≈70, 8칸≈33
  const innerR = totalShown < 0.01 ? 104 : Math.max(30, 107 - 9.2 * totalShown);
  const scale = innerR / R;

  let cursor = START_DEG;
  const wedges: React.ReactElement[] = [];
  shown.forEach((v, i) => {
    if (v < 0.01) return; // 0칸 재료는 렌더링 생략
    const sweep = Math.min(v * CELL_DEG, 360 - RICE_DEG);
    wedges.push(
      <path key={i} d={wedge(cursor, cursor + sweep)} fill={colors[i]}
            stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    );
    cursor += sweep;
  });

  return (
    <svg viewBox="0 0 220 220" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <clipPath id="rice-wedge-clip">
          <path d={wedge(180, 270)} />
        </clipPath>
      </defs>

      {/* 남는 부분(흰색) */}
      <circle cx={C} cy={C} r={R + 2} fill="#fff" />

      {/* 밥 구간: 아트보드 10 쌀 패턴 (밥알이 아주 선명하고 큼직하게 보이도록 대폭 확대) */}
      <g clipPath="url(#rice-wedge-clip)">
        <rect x="0" y="100" width="120" height="120" fill="#FFF8EA" />
        <image
          href="/assets/aistudio/_________10_f456a96d.png"
          x="-320"
          y="-370"
          width="750"
          height="1060"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
      <path
        d={wedge(180, 270)}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* 재료 호 */}
      {wedges}

      {/* 가운데 연두 원: transform scale로만 크기 변화 */}
      <circle
        cx={C}
        cy={C}
        r={R}
        fill="#E8F3DC"
        style={{ transform: `scale(${scale})`, transformOrigin: `${C}px ${C}px` }}
      />

      <text
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'D-DIN', 'DIN Alternate', 'DIN', sans-serif"
        fontWeight={700}
        fontSize={fontSize}
        fill="#1F4D2B"
      >
        {totalTarget}/{MAX_CELLS}
      </text>
    </svg>
  );
}
