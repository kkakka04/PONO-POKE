/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  INGREDIENTS,
  TOTAL_BUDGET,
} from './data/ingredients';
import PreviewRing from './components/PreviewRing';
import { IngredientColumn } from './components/IngredientColumn';
import { ParticleLayer, ParticleHandle } from './components/ParticleLayer';
import {
  ensureAudioContext,
  playCompletionChime,
  playLimitThud,
} from './utils/audio';

const STEPS = ['포케 종류', '메인 토핑', '소스', '기본 재료 양 조절', '사이드', '결제'];

export default function App() {
  const [scale, setScale] = useState<number>(1);
  const stageRef = useRef<HTMLDivElement>(null);

  // 7개 기본 재료 각 칸 수 (기본: 각 1칸, 총 7칸 채움)
  const [counts, setCounts] = useState<number[]>([1, 1, 1, 1, 1, 1, 1]);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const particleRef = useRef<ParticleHandle>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const lastErrTimeRef = useRef<number>(0);
  const prevIsFullRef = useRef<boolean>(false);

  // 1080x1920 스테이지 스케일 계산
  useEffect(() => {
    const handleResize = () => {
      const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      setScale(s);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalSelected = counts.reduce((sum, c) => sum + c, 0);
  const remaining = TOTAL_BUDGET - totalSelected;
  const isFull = remaining === 0;

  // 칸이 모두 채워져 완료 상태가 되는 순간 맑고 부드러운 상승 2음 차임 재생
  useEffect(() => {
    if (isFull && !prevIsFullRef.current) {
      playCompletionChime();
    }
    prevIsFullRef.current = isFull;
  }, [isFull]);

  // 첫 터치/클릭 시 AudioContext resume
  const handleStageInteraction = () => {
    ensureAudioContext();
  };

  // 진동 피드백
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // Ignore vibration errors
    }
  }, []);

  // 토스트 메시지
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 1500);
  }, []);

  // 8칸 초과 시 에러 셰이크
  const handleExceedBudget = useCallback(
    (index: number) => {
      const now = performance.now();
      if (now - lastErrTimeRef.current < 250) return;
      lastErrTimeRef.current = now;

      setErrorIndex(index);
      setTimeout(() => setErrorIndex(null), 450);

      playLimitThud();
      triggerHaptic();
      showToast('8칸이 가득 찼어요. 다른 재료를 줄이면 늘릴 수 있어요');
    },
    [triggerHaptic, showToast]
  );

  // 재료 칸 수 변경
  const handleCountChange = useCallback(
    (index: number, newCount: number) => {
      setCounts((prev) => {
        const next = [...prev];
        next[index] = newCount;
        triggerHaptic();
        return next;
      });
    },
    [triggerHaptic]
  );

  // 드래그 중 입자 우수수 비 내리듯 생성
  const handleDragMove = useCallback(
    (
      index: number,
      barTopX: number,
      barTopY: number,
      isIncreasing: boolean,
      trackWidth: number
    ) => {
      particleRef.current?.spawnDragRain(index, barTopX, barTopY, isIncreasing, trackWidth);
    },
    []
  );

  // 손을 뗄 때 (입자 모임 및 2~3개 튀어오름)
  const handleRelease = useCallback(
    (
      index: number,
      barTopX: number,
      barTopY: number,
      didIncrease: boolean,
      trackWidth: number
    ) => {
      particleRef.current?.onRelease(
        index,
        barTopX,
        barTopY,
        didIncrease,
        trackWidth
      );
    },
    []
  );

  // 초기화 (모두 0칸으로)
  const handleReset = () => {
    ensureAudioContext();
    setCounts([0, 0, 0, 0, 0, 0, 0]);
    triggerHaptic();
  };

  // 완료 버튼 클릭
  const handleCtaClick = () => {
    ensureAudioContext();
    if (isFull) {
      playCompletionChime();
    }
  };

  const getStageRect = useCallback(() => {
    return stageRef.current ? stageRef.current.getBoundingClientRect() : null;
  }, []);

  return (
    <div
      ref={stageRef}
      onPointerDown={handleStageInteraction}
      style={{
        width: '1080px',
        height: '1920px',
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        backgroundColor: '#FFFFFF',
        color: '#2B2B2B',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
      className="flex flex-col justify-between"
    >
      {/* 1. 상단 스텝 (Steps) - 좌우 패딩 48px 정확히 일치 */}
      <div
        style={{
          width: '1080px',
          height: '172px',
          padding: '28px 48px 0 48px',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          flex: 'none',
        }}
      >
        {STEPS.map((s, i) => {
          const isDone = i < 3;
          const isCur = i === 3;
          return (
            <div
              key={s}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
              }}
            >
              {/* 스텝 사이 연결선 */}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    width: '100%',
                    top: '29px',
                    height: '2px',
                    backgroundColor: isDone ? '#77E024' : '#EAEAEA',
                    zIndex: 0,
                  }}
                />
              )}

              {/* 스텝 원형 점 */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: "'D-DIN', 'DIN Alternate', 'DIN', sans-serif",
                  backgroundColor: isDone
                    ? '#77E024'
                    : isCur
                    ? '#1F4D2B'
                    : '#EAEAEA',
                  color: isDone || isCur ? '#FFFFFF' : '#8A8A8A',
                }}
              >
                {isDone ? '✓' : i + 1}
              </div>

              {/* 스텝 라벨 */}
              <div
                style={{
                  fontSize: '22px',
                  lineHeight: '1.25',
                  color: isCur ? '#1F4D2B' : isDone ? '#2B2B2B' : '#8A8A8A',
                  fontWeight: isCur ? 800 : 500,
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                }}
              >
                {s}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. 메인 영역 (헤드라인, 미리보기, 7열 재료) */}
      <main
        style={{
          width: '1080px',
          boxSizing: 'border-box',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '20px 0',
        }}
      >
        {/* 상단 헤드라인 및 도넛 미리보기 - 좌우 패딩 48px, 미리보기 우측 x=1032에 일치 */}
        <div
          style={{
            width: '1080px',
            padding: '10px 48px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          {/* 헤드라인 문구 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              whiteSpace: 'nowrap',
            }}
          >
            {isFull ? (
              <span
                style={{
                  fontSize: '80px',
                  fontWeight: 800,
                  color: '#1F4D2B',
                  lineHeight: 1,
                }}
              >
                다 채웠어요
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                <span
                  style={{
                    fontSize: '150px',
                    fontWeight: 800,
                    color: '#1F4D2B',
                    lineHeight: 1,
                    fontFamily: "'D-DIN', 'DIN Alternate', 'DIN', sans-serif",
                  }}
                >
                  {remaining}
                </span>
                <span
                  style={{
                    fontSize: '46px',
                    fontWeight: 500,
                    color: '#2B2B2B',
                  }}
                >
                  칸 남았어요
                </span>
              </div>
            )}
          </div>

          {/* 원형 도넛 미리보기 & 고정 (밥) 범례 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ width: '250px', height: '250px' }}>
              <PreviewRing
                counts={counts}
                colors={INGREDIENTS.map((ing) => ing.color)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '24px',
                color: '#8A8A8A',
              }}
            >
              <i
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundImage: 'url(/assets/aistudio/_________10_f456a96d.png)',
                  backgroundSize: '220px auto',
                  backgroundPosition: 'center',
                  display: 'inline-block',
                  border: '1px solid #D4C0A8',
                }}
              />
              <span>고정 (밥)</span>
            </div>
          </div>
        </div>

        {/* 7열 재료 바 영역 - 폭 정확히 984px (1080 - 96), 맨 오른쪽 끝이 x=1032에 일치 */}
        <div
          style={{
            width: '984px',
            margin: '0 auto',
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            alignItems: 'stretch',
            position: 'relative',
          }}
        >
          {INGREDIENTS.map((ing, i) => (
            <IngredientColumn
              key={ing.id}
              index={i}
              ingredient={ing}
              count={counts[i]}
              allCounts={counts}
              stageScale={scale}
              stageRectGetter={getStageRect}
              onChangeCount={handleCountChange}
              onExceedBudget={handleExceedBudget}
              onDragMove={handleDragMove}
              onRelease={handleRelease}
              isError={errorIndex === i}
            />
          ))}
        </div>
      </main>

      {/* 3. 하단 액션 바 (초기화, 완료/채워주세요 버튼) - 좌우 패딩 48px, 우측 끝 x=1032 */}
      <div
        style={{
          width: '1080px',
          height: '220px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '0 48px',
          boxSizing: 'border-box',
        }}
      >
        {/* 초기화 버튼 */}
        <button
          id="reset"
          type="button"
          onClick={handleReset}
          style={{
            background: 'none',
            border: 0,
            font: 'inherit',
            fontSize: '30px',
            color: '#8A8A8A',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 20px',
            cursor: 'pointer',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          <span>초기화</span>
        </button>

        {/* CTA 버튼 */}
        <button
          id="cta"
          type="button"
          disabled={!isFull}
          onClick={handleCtaClick}
          style={{
            flex: 1,
            height: '140px',
            borderRadius: '36px',
            border: 0,
            font: 'inherit',
            fontSize: '38px',
            fontWeight: 800,
            transition: 'background 0.25s, color 0.25s',
            backgroundColor: isFull ? '#77E024' : '#EAEAEA',
            color: isFull ? '#1F4D2B' : '#9A9A9A',
            cursor: isFull ? 'pointer' : 'default',
          }}
        >
          {isFull ? (
            '완료'
          ) : (
            <span>
              <span style={{ fontFamily: "'D-DIN', 'DIN Alternate', 'DIN', sans-serif" }}>
                {remaining}
              </span>
              칸 더 채워주세요
            </span>
          )}
        </button>
      </div>

      {/* 토스트 알림 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '260px',
          transform: toastMessage
            ? 'translate(-50%, 0)'
            : 'translate(-50%, 20px)',
          backgroundColor: '#2B2B2B',
          color: '#FFFFFF',
          fontSize: '28px',
          padding: '20px 40px',
          borderRadius: '40px',
          opacity: toastMessage ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.25s, transform 0.25s',
          zIndex: 40,
          whiteSpace: 'nowrap',
        }}
      >
        {toastMessage}
      </div>

      {/* 큐브 파티클 레이어 */}
      <ParticleLayer ref={particleRef} />
    </div>
  );
}
