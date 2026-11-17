import React, { useRef, useState, useEffect } from 'react';
import {
  Ingredient,
  shadeColor,
  TOTAL_BUDGET,
  MAX_PORTION,
  SLOT_GAP,
  SLOT_HEIGHT,
} from '../data/ingredients';
import { playLimitThud, ensureAudioContext } from '../utils/audio';

interface IngredientColumnProps {
  index: number;
  ingredient: Ingredient;
  count: number;
  allCounts: number[];
  stageScale: number;
  stageRectGetter: () => DOMRect | null;
  onChangeCount: (index: number, newCount: number) => void;
  onExceedBudget: (index: number) => void;
  onDragMove?: (
    index: number,
    barTopX: number,
    barTopY: number,
    isIncreasing: boolean,
    trackWidth: number
  ) => void;
  onRelease?: (
    index: number,
    barTopX: number,
    barTopY: number,
    didIncrease: boolean,
    trackWidth: number
  ) => void;
  isError: boolean;
}

// Convert level (0~2) to track bottom %
const P = (l: number): number =>
  l <= 1 ? l * SLOT_HEIGHT : SLOT_HEIGHT + (l - 1) * (SLOT_HEIGHT + SLOT_GAP);

// Convert percentage to continuous level (0~2)
const L = (p: number): number =>
  p <= SLOT_HEIGHT ? p / SLOT_HEIGHT : 1 + (p - SLOT_HEIGHT) / (SLOT_HEIGHT + SLOT_GAP);

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Ingredient visual volume scale fine-tuning
const INGREDIENT_VISUAL_SCALE: Record<string, number> = {
  mix: 1.05,
  seaweed: 1.05,
  crab: 1.18,
  onion: 1.18,
  corn: 1.12,
  bean: 1.12,
  redcabbage: 1.12,
};

export const IngredientColumn: React.FC<IngredientColumnProps> = ({
  index,
  ingredient,
  count,
  allCounts,
  stageScale,
  stageRectGetter,
  onChangeCount,
  onExceedBudget,
  onDragMove,
  onRelease,
  isError,
}) => {
  const [level, setLevel] = useState<number>(count);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    lastY: number;
    startCount: number;
    moved: boolean;
    acc: number;
    pid: number;
  } | null>(null);

  // Sync level with external count changes (unless actively dragging)
  useEffect(() => {
    if (!isDragging) {
      setLevel(count);
    }
  }, [count, isDragging]);

  const totalOther = allCounts.reduce((acc, val, i) => (i === index ? acc : acc + val), 0);
  const maxAllowed = Math.min(MAX_PORTION, TOTAL_BUDGET - totalOther);

  const getStageCoords = (clientX: number, clientY: number) => {
    const sRect = stageRectGetter();
    if (!sRect || stageScale <= 0) return { stageX: clientX, stageY: clientY };
    return {
      stageX: (clientX - sRect.left) / stageScale,
      stageY: (clientY - sRect.top) / stageScale,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ensureAudioContext();
    const track = trackRef.current;
    if (!track) return;

    track.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      startCount: count,
      moved: false,
      acc: 0,
      pid: e.pointerId,
    };
    setIsDragging(true);

    handlePointerMove(e, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, isInitial = false) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track) return;
    if (e.pointerId !== drag.pid) return;

    const rect = track.getBoundingClientRect();
    const percent = ((rect.bottom - e.clientY) / rect.height) * 100;
    let newLevel = clamp(L(percent), 0, MAX_PORTION);

    // 한도 초과 시도시 툭 소리 + 흔들림 + 토스트
    if (newLevel > maxAllowed + 0.001) {
      newLevel = maxAllowed;
      playLimitThud();
      onExceedBudget(index);
    }

    setLevel(newLevel);

    const screenDy = e.clientY - drag.lastY;
    const stageDy = screenDy / (stageScale || 1);

    if (Math.abs(e.clientY - drag.startY) > 6) {
      drag.moved = true;
    }

    if (!isInitial && drag.moved) {
      drag.acc += Math.abs(stageDy);
      // 드래그 이동 12px당 2~3개 생성
      if (drag.acc >= 12) {
        drag.acc = 0;
        const trackStageWidth = rect.width / (stageScale || 1);
        const { stageX: centerStageX } = getStageCoords(rect.left + rect.width / 2, 0);

        // 현재 채워진 바 윗면 stage 좌표
        const currentBottomPercent = P(newLevel);
        const currentScreenY = rect.bottom - (rect.height * currentBottomPercent) / 100;
        const { stageY: topStageY } = getStageCoords(0, currentScreenY);

        const isIncreasing = stageDy < 0; // 위로 드래그 = 칸 늘림
        onDragMove?.(index, centerStageX, topStageY, isIncreasing, trackStageWidth);
      }
    }

    drag.lastY = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track) return;

    let targetCount = Math.round(level);

    // 탭 동작 감지
    if (!drag.moved) {
      if (drag.startCount > 0) {
        targetCount = drag.startCount - 1;
      } else {
        targetCount = Math.min(1, maxAllowed);
        if (maxAllowed < 1) {
          playLimitThud();
          onExceedBudget(index);
        }
      }
    }

    targetCount = clamp(targetCount, 0, maxAllowed);

    setLevel(targetCount);
    setIsDragging(false);

    if (track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }

    const rect = track.getBoundingClientRect();
    const trackStageWidth = rect.width / (stageScale || 1);
    const { stageX: centerStageX } = getStageCoords(rect.left + rect.width / 2, 0);

    const targetBottomPercent = P(targetCount);
    const targetScreenY = rect.bottom - (rect.height * targetBottomPercent) / 100;
    const { stageY: topStageY } = getStageCoords(0, targetScreenY);

    const didIncrease = targetCount > drag.startCount;

    if (targetCount !== count) {
      onChangeCount(index, targetCount);
    }

    onRelease?.(index, centerStageX, topStageY, didIncrease, trackStageWidth);

    dragRef.current = null;
  };

  const isZero = level < 0.05;
  const bottomPercent = P(level);

  // Pill styling
  const pillBg = count > 0 ? shadeColor(ingredient.color, 0.8) : '#EFEFEF';
  const pillColor = count > 0 ? shadeColor(ingredient.color, -0.45) : '#B0B0B0';

  const baseScale = INGREDIENT_VISUAL_SCALE[ingredient.id] || 1.12;
  const visualScale = isZero ? baseScale * 0.72 : baseScale;

  return (
    <div
      className="flex flex-col items-center justify-between h-full touch-none select-none cursor-pointer w-full"
    >
      {/* Top Portion Pill */}
      <div
        className="flex items-center justify-center font-extrabold select-none transition-colors duration-200"
        style={{
          width: '84px',
          height: '84px',
          borderRadius: '50%',
          fontSize: '38px',
          fontFamily: "'D-DIN', 'DIN Alternate', 'DIN', sans-serif",
          backgroundColor: pillBg,
          color: pillColor,
        }}
        onClick={(e) => {
          e.stopPropagation();
          ensureAudioContext();
          if (count > 0) {
            onChangeCount(index, count - 1);
            setLevel(count - 1);
          }
        }}
      >
        {count}
      </div>

      {/* Main Track (2분할 회색 트랙: 위/아래 2개 조각, 간격 약 24px, 양끝 완전 둥글게) */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => handlePointerMove(e, false)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex-1 cursor-pointer touch-none select-none ${
          isError ? 'animate-shake' : ''
        }`}
        style={{
          width: '92px',
          marginTop: '40px',
          marginBottom: '20px',
          backgroundColor: 'transparent', // 분할된 2개 트랙 조각을 보여주기 위해 컨테이너 배경은 투명
        }}
      >
        {/* 회색 트랙 조각 1 (하단, Slot 1) - 높이 48%, 완전히 둥글게, 채워지면 고유색상 */}
        <div
          className="absolute left-0 right-0 pointer-events-none transition-colors duration-180"
          style={{
            bottom: '0%',
            height: `${SLOT_HEIGHT}%`,
            borderRadius: '46px',
            backgroundColor: count >= 1 ? ingredient.color : '#EAEAEA',
            outline: isError ? '4px solid #FF5A4F' : 'none',
            outlineOffset: '2px',
          }}
        />

        {/* 회색 트랙 조각 2 (상단, Slot 2) - 높이 48%, 완전히 둥글게, 조각 사이 간격 4%(약 24px), 채워지면 고유색상 */}
        <div
          className="absolute left-0 right-0 pointer-events-none transition-colors duration-180"
          style={{
            bottom: `${SLOT_HEIGHT + SLOT_GAP}%`,
            height: `${SLOT_HEIGHT}%`,
            borderRadius: '46px',
            backgroundColor: count >= 2 ? ingredient.color : '#EAEAEA',
            outline: isError ? '4px solid #FF5A4F' : 'none',
            outlineOffset: '2px',
          }}
        />

        {/* Floating Illustration
            - 가로: 바의 좌우 정중앙 (left: 50%, translate -50%)
            - 세로: 채워진 칸의 맨 윗면에 일러스트 중심이 오게 (translateY 50%)
            - 0칸일 때도 가로는 바 정중앙, 세로는 바 맨 아래
            - 크기: 바 폭의 약 120%
        */}
        <div
          className="absolute pointer-events-none z-10 select-none flex items-center justify-center"
          style={{
            left: '50%',
            width: '120%', // 92px의 120% = ~110px
            bottom: isZero ? '0%' : `${bottomPercent}%`,
            transform: isZero
              ? `translate(-50%, 15%) scale(${visualScale})`
              : `translate(-50%, 50%) scale(${visualScale})`,
            opacity: isZero ? 0.55 : 1,
            transition: isDragging
              ? 'none'
              : 'bottom 0.28s cubic-bezier(0.34, 1.45, 0.64, 1), transform 0.28s, opacity 0.28s',
          }}
        >
          {imgError ? (
            <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px' }}>
              <circle cx="50" cy="50" r="38" fill={ingredient.color} />
            </svg>
          ) : (
            <img
              src={ingredient.image}
              alt=""
              draggable={false}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      </div>

      {/* Ingredient Name (바 아래 정중앙, 140px 내에 잘림 없이 한 줄 표시) */}
      <div
        className="text-center font-medium select-none whitespace-nowrap w-full"
        style={{
          fontSize: '24px',
          letterSpacing: '-0.5px',
          color: '#2B2B2B',
          paddingBottom: '8px',
        }}
      >
        {ingredient.name}
      </div>
    </div>
  );
};
