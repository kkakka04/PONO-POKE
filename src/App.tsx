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

const STEPS: { lines: string[] }[] = [
  { lines: ['포케 종류'] },
  { lines: ['메인 토핑'] },
  { lines: ['소스'] },
  { lines: ['기본 재료', '양 조절'] },
  { lines: ['사이드'] },
  { lines: ['결제'] },
];

// 수정한 글자 크기 상수 모음 (1080×1920 스테이지 기준, 모든 텍스트 최소 24px 이상)
export const FONT_SIZES = {
  stepNumber: 24,
  stepLabel: 24,
  headlineNumber: 150,
  headlineText: 56,
  headlineFull: 80,
  headlineSub: 28,
  donutCounter: 38,
  legend: 24,
  badge: 28,
  barLabel: 26,
  resetButton: 30,
  ctaActive: 34,
  ctaInactive: 40,
  toast: 24,
} as const;

export default function App() {
  const [scale, setScale] = useState<number>(1);
  const stageRef = useRef<HTMLDivElement>(null);

  // 7개 기본 재료 각 칸 수 (기본: 각 1칸, 총 7칸 채움)
  const [counts, setCounts] = useState<number[]>([1, 1, 1, 1, 1, 1, 1]);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetPressed, setIsResetPressed] = useState<boolean>(false);

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
        padding: '72px 120px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      {/* 1. 상단 존 (정보): 스텝바 + 48px 간격 + 헤드라인 & 280px 도넛 */}
      <header
        style={{
          width: '100%',
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 스텝바 (첫 번째 원 왼쪽 끝 = 왼쪽 기준선, 마지막 원 오른쪽 끝 = 오른쪽 기준선) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '48px',
          }}
        >
          {/* 스텝 사이 연결선 트랙 (첫 번째 원 중심 ~ 마지막 원 중심) */}
          <div
            style={{
              position: 'absolute',
              left: '27px',
              right: '27px',
              top: '27px',
              height: '2px',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              zIndex: 0,
            }}
          >
            {STEPS.slice(0, -1).map((step, i) => (
              <div
                key={`line-${step.lines.join('-')}`}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: i < 3 ? '#77E024' : '#EAEAEA',
                }}
              />
            ))}
          </div>

          {STEPS.map((step, i) => {
            const isDone = i < 3;
            const isCur = i === 3;
            const isFirst = i === 0;
            const isLast = i === STEPS.length - 1;
            return (
              <div
                key={step.lines.join('-')}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: '54px',
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '8px',
                }}
              >
                {/* 스텝 원형 점 (지름 54px) */}
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: `${FONT_SIZES.stepNumber}px`,
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

                {/* 스텝 라벨 (2줄 기준 고정 높이로 첫 줄 Y 위치 통일) */}
                <div
                  style={{
                    fontSize: `${FONT_SIZES.stepLabel}px`,
                    lineHeight: 1.25,
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center',
                    color: isCur ? '#1F4D2B' : isDone ? '#2B2B2B' : '#8A8A8A',
                    fontWeight: isCur ? 700 : 500,
                    textAlign: isFirst ? 'left' : isLast ? 'right' : 'center',
                    alignSelf: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center',
                    width: 'max-content',
                    wordBreak: 'keep-all',
                  }}
                >
                  {step.lines.map((line) => (
                    <span key={line} style={{ whiteSpace: 'nowrap' }}>
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 헤드라인 블록(왼쪽) + 280px 도넛(오른쪽) 세로 중앙 정렬 (그룹 전체 아래로 60px 이동) */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transform: 'translateY(60px)',
          }}
        >
          {/* 헤드라인 + 안내 문구 블록 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
              }}
            >
              {isFull ? (
                <span
                  style={{
                    fontSize: `${FONT_SIZES.headlineFull}px`,
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
                      fontSize: `${FONT_SIZES.headlineNumber}px`,
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
                      fontSize: `${FONT_SIZES.headlineText}px`,
                      fontWeight: 700,
                      color: '#2B2B2B',
                    }}
                  >
                    칸 남았어요
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: `${FONT_SIZES.headlineSub}px`,
                fontWeight: 500,
                color: '#4A5A4C',
                lineHeight: 1.25,
              }}
            >
              막대를 위아래로 끌어서 양을 조절해요
            </div>
          </div>

          {/* 원형 도넛 미리보기 (지름 280px) & 고정 (밥) 범례 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ width: '280px', height: '280px' }}>
              <PreviewRing
                counts={counts}
                colors={INGREDIENTS.map((ing) => ing.color)}
                fontSize={FONT_SIZES.donutCounter}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: `${FONT_SIZES.legend}px`,
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
      </header>

      {/* 2. 중단 존 (조작): 공통 컨테이너 폭에 맞춰 80px 막대 7열 균등 분배 */}
      <section
        style={{
          width: '100%',
          flex: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
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
            badgeFontSize={FONT_SIZES.badge}
            labelFontSize={FONT_SIZES.barLabel}
          />
        ))}
      </section>

      {/* 3. 하단 존 (행동): 초기화 + CTA 버튼 (공통 컨테이너 폭과 동일, 높이 120px) */}
      <footer
        style={{
          width: '100%',
          height: '120px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxSizing: 'border-box',
        }}
      >
        {/* 초기화 버튼 (폭 220px, 높이 120px, 흰 배경, 2px #CFCFCF 테두리, pressed 피드백) */}
        <button
          id="reset"
          type="button"
          onClick={handleReset}
          onPointerDown={() => setIsResetPressed(true)}
          onPointerUp={() => setIsResetPressed(false)}
          onPointerLeave={() => setIsResetPressed(false)}
          onPointerCancel={() => setIsResetPressed(false)}
          onBlur={() => setIsResetPressed(false)}
          style={{
            width: '220px',
            height: '120px',
            flex: 'none',
            borderRadius: '32px',
            backgroundColor: isResetPressed ? '#EDEDED' : '#FFFFFF',
            border: '2px solid #CFCFCF',
            font: 'inherit',
            fontSize: `${FONT_SIZES.resetButton}px`,
            fontWeight: 600,
            color: '#3F4A41',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxSizing: 'border-box',
            cursor: 'pointer',
            transition: 'background-color 0.12s',
          }}
        >
          <svg
            width="36"
            height="36"
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

        {/* CTA 버튼 (높이 120px, 남은 폭 채움) */}
        <button
          id="cta"
          type="button"
          disabled={!isFull}
          onClick={handleCtaClick}
          style={{
            flex: 1,
            height: '120px',
            borderRadius: '32px',
            border: 0,
            font: 'inherit',
            fontSize: `${isFull ? FONT_SIZES.ctaActive : FONT_SIZES.ctaInactive}px`,
            fontWeight: isFull ? 800 : 700,
            transition: 'background 0.25s, color 0.25s',
            backgroundColor: isFull ? '#77E024' : '#EAEAEA',
            color: isFull ? '#1F4D2B' : '#5F5F5F',
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
      </footer>

      {/* 토스트 알림 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '220px',
          transform: toastMessage
            ? 'translate(-50%, 0)'
            : 'translate(-50%, 20px)',
          backgroundColor: '#2B2B2B',
          color: '#FFFFFF',
          fontSize: `${FONT_SIZES.toast}px`,
          padding: '18px 36px',
          borderRadius: '36px',
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
