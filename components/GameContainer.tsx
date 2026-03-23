
import React, { useEffect, useRef, useState } from 'react';
import blueImage from '../blue.png';
import greenImage from '../green.png';
import redImage from '../red.png';
import packImage from '../pack.png';
import box90Image from '../90.png';
import bonusImage from '../bonus.png';
import infoImage from '../info.png';
import backIconImage from '../backicon.png';

// Image paths mapping
const imagePaths: { [key: string]: string } = {
  'blue.png': blueImage,
  'green.png': greenImage,
  'red.png': redImage
};

type BoxType = 'pack' | 'grandaxin90';

interface GameObject {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  type: 'pill' | 'symptom' | 'particle' | 'bonus';
  color?: string;
  id: number;
  health: number;
  maxHealth: number;
  life?: number;
  isBoss?: boolean;
  side?: 'left' | 'right';
  imageSrc?: string;
}

const GameContainer: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const boxAreaRef = useRef<HTMLDivElement>(null);
  const tapAreaRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef<{ type: 'touch' | 'mouse' | null; time: number }>({ type: null, time: 0 });
  
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [integrity, setIntegrity] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Reload Mechanic States
  const [pillsInPack, setPillsInPack] = useState(20);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadPhase, setReloadPhase] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const [imgError, setImgError] = useState(false);

  // Grandaxin 90 box (bonus)
  const [boxType, setBoxType] = useState<BoxType>('pack');
  const boxTypeRef = useRef<BoxType>('pack');
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const hasGrandaxin90UnlockedRef = useRef(false);
  
  // Statistics
  const [totalPillsUsed, setTotalPillsUsed] = useState(0);
  const [symptomsEliminated, setSymptomsEliminated] = useState({ blue: 0, green: 0, red: 0 });

  const objectsRef = useRef<GameObject[]>([]);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const integrityRef = useRef(100);
  const gameOverRef = useRef(false);
  const lastSpawnRef = useRef(0);
  const lastBonusSpawnRef = useRef(0);
  const nextIdRef = useRef(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [boxOffsetX, setBoxOffsetX] = useState(0);
  const savedBoxOffsetXRef = useRef(0);
  
  // Stars for space background
  const starsRef = useRef<Array<{ x: number; y: number; z: number; speed: number }>>([]);
  
  // Symptom images
  const symptomImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  // Bonus flying object image
  const bonusImageRef = useRef<HTMLImageElement | null>(null);

  const showBonusPopupRef = useRef(false);
  useEffect(() => {
    scoreRef.current = score;
    levelRef.current = level;
    integrityRef.current = integrity;
    gameOverRef.current = gameOver;
    boxTypeRef.current = boxType;
    showBonusPopupRef.current = showBonusPopup;
  }, [score, level, integrity, gameOver, boxType, showBonusPopup]);


  // Space background animation
  useEffect(() => {
    const backgroundCanvas = backgroundCanvasRef.current;
    const container = containerRef.current;
    if (!backgroundCanvas || !container) return;
    
    const ctx = backgroundCanvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      backgroundCanvas.width = container.clientWidth;
      backgroundCanvas.height = container.clientHeight;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // Initialize stars
    const initStars = () => {
      starsRef.current = [];
      const starCount = 200;
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * backgroundCanvas.width,
          y: Math.random() * backgroundCanvas.height,
          z: Math.random() * 1000,
          speed: 0.5 + Math.random() * 2
        });
      }
    };
    initStars();

    let animationId: number;
    const update = () => {
      // Очищаем canvas прозрачным цветом, чтобы не перекрывать фон
      ctx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
      
      // Рисуем темный фон только если нужно
      ctx.fillStyle = 'rgba(10, 15, 30, 0.3)';
      ctx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        
        // Move star towards camera
        star.z -= star.speed;
        
        // If star is too close, reset it
        if (star.z <= 0) {
          star.x = Math.random() * backgroundCanvas.width;
          star.y = Math.random() * backgroundCanvas.height;
          star.z = 1000;
        }
        
        // Calculate star position with perspective
        const x = (star.x - backgroundCanvas.width / 2) * (400 / star.z) + backgroundCanvas.width / 2;
        const y = (star.y - backgroundCanvas.height / 2) * (400 / star.z) + backgroundCanvas.height / 2;
        const radius = Math.max(0.5, (1 - star.z / 1000) * 3);
        const opacity = Math.max(0.3, 1 - star.z / 1000);
        
        // Draw star trail for fast stars first
        if (star.speed > 1.5) {
          const prevX = (star.x - backgroundCanvas.width / 2) * (400 / (star.z + star.speed * 10)) + backgroundCanvas.width / 2;
          const prevY = (star.y - backgroundCanvas.height / 2) * (400 / (star.z + star.speed * 10)) + backgroundCanvas.height / 2;
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        
        // Draw star
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, []);


  const resetGame = () => {
    objectsRef.current = [];
    scoreRef.current = 0;
    levelRef.current = 1;
    integrityRef.current = 100;
    gameOverRef.current = false;
    lastSpawnRef.current = performance.now();
    lastBonusSpawnRef.current = 0;
    hasGrandaxin90UnlockedRef.current = false;
    setScore(0);
    setLevel(1);
    setIntegrity(100);
    setGameOver(false);
    setShowInstructions(false);
    setPillsInPack(20);
    setBoxType('pack');
    setShowBonusPopup(false);
    setIsReloading(false);
    setReloadPhase('idle');
    setBoxOffsetX(0);
    setTotalPillsUsed(0);
    setSymptomsEliminated({ blue: 0, green: 0, red: 0 });
  };

  const playSound = (type: 'shoot' | 'pop' | 'bossHit' | 'leak' | 'reload') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'shoot') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
      } else if (type === 'pop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
      } else if (type === 'leak') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
      } else if (type === 'bossHit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
      } else if (type === 'reload') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  const createParticles = (x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      objectsRef.current.push({
        id: nextIdRef.current++,
        x, y,
        radius: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        type: 'particle',
        color,
        health: 0,
        maxHealth: 0,
        life: 1.0
      });
    }
  };

  const spawnSymptom = (width: number, height: number) => {
    const currentLevel = levelRef.current;
    const side = Math.random() > 0.5 ? 'left' : 'right';
    
    // Рандомно выбираем изображение симптома
    const symptomTypes = ['blue.png', 'green.png', 'red.png'];
    const imageSrc = symptomTypes[Math.floor(Math.random() * symptomTypes.length)];
    
    const roll = Math.random();
    let radius, health, speedMult, color;
    
    if (roll < 0.5) { // Small & Fast
      radius = 12 + Math.random() * 4;
      health = 1;
      speedMult = 1.4 + Math.random() * 0.4;
      color = '#4de6ff'; // Cyan
    } else if (roll < 0.85) { // Medium
      radius = 22 + Math.random() * 5;
      health = 2;
      speedMult = 0.9 + Math.random() * 0.3;
      color = '#4dff88'; // Green
    } else { // Large & Slow
      radius = 38 + Math.random() * 8;
      health = 3;
      speedMult = 0.5 + Math.random() * 0.2;
      color = '#ff4dff'; // Pink/Purple
    }

    const startX = side === 'left' ? -radius : width + radius;
    const startY = 80 + Math.random() * (height * 0.45);
    const baseSpeed = (0.8 + Math.random() * 1.0) * (1 + currentLevel * 0.06);
    const vx = (side === 'left' ? baseSpeed : -baseSpeed) * speedMult;

    objectsRef.current.push({
      id: nextIdRef.current++,
      x: startX,
      y: startY,
      radius,
      vx,
      vy: 0,
      type: 'symptom',
      color,
      health,
      maxHealth: health,
      side,
      imageSrc
    });
  };

  const spawnBonus = (width: number, height: number) => {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const radius = 38 + Math.random() * 8;
    const health = 3;
    const speedMult = 0.5 + Math.random() * 0.2;
    const baseSpeed = 0.6 + Math.random() * 0.5;
    const vx = (side === 'left' ? baseSpeed : -baseSpeed) * speedMult;
    const startX = side === 'left' ? -radius : width + radius;
    const startY = 80 + Math.random() * (height * 0.45);

    objectsRef.current.push({
      id: nextIdRef.current++,
      x: startX,
      y: startY,
      radius,
      vx,
      vy: 0,
      type: 'bonus',
      color: '#ffd700',
      health,
      maxHealth: health,
      side
    });
  };

  const triggerReload = () => {
    if (isReloading) return;
    
    // Сохраняем текущую позицию коробки перед перезарядкой
    savedBoxOffsetXRef.current = boxOffsetX;
    setIsReloading(true);
    setReloadPhase('exiting');
    playSound('reload');
    
    // Анимация выхода - 600ms (одинаковая с entering)
    const animationDuration = 600;
    
    setTimeout(() => {
      setBoxType('pack');
      setPillsInPack(20);
      setBoxOffsetX(savedBoxOffsetXRef.current);
      setTimeout(() => {
        setReloadPhase('entering');
        
        // Анимация входа - 600ms (одинаковая с exiting)
        setTimeout(() => {
          // Сначала переходим в idle, но оставляем isReloading true для плавного перехода
          setReloadPhase('idle');
          // Убираем isReloading после небольшой задержки для завершения анимации
          setTimeout(() => {
            setIsReloading(false);
          }, 50);
        }, animationDuration);
      }, 16); // Один кадр для применения изменений
    }, animationDuration);
  };

  const addPillAt = (x: number, canvasHeight: number) => {
    objectsRef.current.push({
      id: nextIdRef.current++,
      x,
      y: canvasHeight - 120,
      radius: 10,
      vx: 0,
      vy: -20,
      type: 'pill',
      health: 1,
      maxHealth: 1
    });
  };

  const shootPill = (originX: number) => {
    if (gameOverRef.current || isReloading) return;

    const consume = boxType === 'grandaxin90' ? 3 : 1;
    if (pillsInPack < consume) {
      if (pillsInPack <= 0) triggerReload();
      return;
    }

    setTotalPillsUsed(prev => prev + consume);
    setPillsInPack(prev => {
      const next = prev - consume;
      if (next === 0) setTimeout(triggerReload, 100);
      return next;
    });

    setIsPulsing(true);
    playSound('shoot');
    setTimeout(() => setIsPulsing(false), 100);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (boxType === 'grandaxin90') {
      addPillAt(originX - 12, canvas.height);
      setTimeout(() => addPillAt(originX, canvas.height), 50);
      setTimeout(() => addPillAt(originX + 12, canvas.height), 100);
    } else {
      addPillAt(originX, canvas.height);
    }
  };

  const handleBoxInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameOverRef.current || isReloading) return;
    
    const container = containerRef.current;
    const boxArea = boxAreaRef.current;
    if (!container || !boxArea) return;

    const containerRect = container.getBoundingClientRect();
    const boxAreaRect = boxArea.getBoundingClientRect();
    let clientX: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent).clientX;
    }

    const relativeX = clientX - containerRect.left;
    // Вычисляем смещение относительно центра области коробки
    const boxAreaCenterX = boxAreaRect.left + boxAreaRect.width / 2;
    let offsetX = clientX - boxAreaCenterX;
    
    // Ограничиваем максимальное смещение, чтобы коробка могла двигаться почти до краев экрана
    // Используем ширину контейнера, а не области коробки
    const maxOffset = (containerRect.width / 2) - 60; // 60px - минимальный отступ от края
    offsetX = Math.max(-maxOffset, Math.min(maxOffset, offsetX));
    
    // Вычисляем текущую позицию коробки
    const currentOffsetX = boxOffsetX;
    const distanceToTravel = Math.abs(offsetX - currentOffsetX);
    
    // Приблизительная ширина коробки (изображение коробки примерно 60-80px)
    const boxHalfWidth = 35; // Половина ширины коробки
    
    // Вычисляем, когда край коробки достигнет точки тапа
    // transition duration = 100ms для перемещения коробки
    let shootDelay = 100; // Базовая задержка (когда центр достигнет точки)
    
    if (distanceToTravel > 0) {
      // Вычисляем расстояние, которое должен пройти центр, чтобы край достиг точки тапа
      // Если тап справа: центр должен быть в (точка тапа - boxHalfWidth)
      // Если тап слева: центр должен быть в (точка тапа + boxHalfWidth)
      const direction = offsetX > currentOffsetX ? 1 : -1;
      const edgeTargetOffset = offsetX - (direction * boxHalfWidth);
      const edgeDistance = Math.abs(edgeTargetOffset - currentOffsetX);
      
      // Если край уже достиг точки тапа (расстояние очень мало), выстрел сразу
      if (edgeDistance < 5) {
        shootDelay = 0;
      } else {
        // Вычисляем задержку пропорционально расстоянию до края
        // transition = 100ms для полного расстояния, вычисляем для расстояния до края
        const totalDistance = distanceToTravel;
        const progressToEdge = Math.min(1, edgeDistance / totalDistance);
        shootDelay = 100 * progressToEdge;
      }
    } else {
      // Если коробка уже на месте, выстрел сразу
      shootDelay = 0;
    }
    
    // Плавно перемещаем коробку к точке тапа
    setBoxOffsetX(offsetX);
    
    // Выполняем выстрел когда край коробки достигнет точки тапа
    setTimeout(() => {
      shootPill(relativeX);
    }, Math.max(0, Math.min(100, shootDelay)));
  };

  // Load symptom images and bonus image
  useEffect(() => {
    const imageNames = ['blue.png', 'green.png', 'red.png'];
    imageNames.forEach(name => {
      const img = new Image();
      img.src = imagePaths[name];
      img.onload = () => {
        symptomImagesRef.current[name] = img;
      };
    });
    const bonusImg = new Image();
    bonusImg.src = bonusImage;
    bonusImg.onload = () => {
      bonusImageRef.current = bonusImg;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let animationId: number;
    const update = (time: number) => {
      if (gameOverRef.current) {
        animationId = requestAnimationFrame(update);
        return;
      }
      if (showBonusPopupRef.current) {
        animationId = requestAnimationFrame(update);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentScore = scoreRef.current;
      const newLevel = Math.floor(currentScore / 250) + 1;
      if (newLevel !== levelRef.current) setLevel(newLevel);

      const spawnRate = Math.max(400, 1600 - levelRef.current * 100);
      if (time - lastSpawnRef.current > spawnRate) {
        spawnSymptom(canvas.width, canvas.height);
        lastSpawnRef.current = time;
      }

      const bonusSpawnInterval = 28000 + Math.random() * 17000;
      if (time - lastBonusSpawnRef.current > bonusSpawnInterval) {
        spawnBonus(canvas.width, canvas.height);
        lastBonusSpawnRef.current = time;
      }

      // Прозрачный фон, чтобы видеть звезды
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(10, 15, 30, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const objects = objectsRef.current;
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        
        let currentVX = obj.vx;
        let currentVY = obj.vy;
        if (obj.type === 'symptom' || obj.type === 'bonus') {
          currentVY = Math.sin(time / 350 + obj.id) * 1.5;
        }
        
        obj.x += currentVX;
        obj.y += currentVY;

        if (obj.type === 'particle') {
          obj.life! -= 0.025;
          if (obj.life! <= 0) {
            objects.splice(i, 1);
            continue;
          }
        }

        if (obj.type === 'pill') {
          for (let j = objects.length - 1; j >= 0; j--) {
            const target = objects[j];
            if (target.type === 'symptom') {
              const dx = obj.x - target.x;
              const dy = obj.y - target.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < obj.radius + target.radius) {
                target.health -= 1;
                createParticles(obj.x, obj.y, target.color || '#fff', target.health <= 0 ? 12 : 5);
                objects.splice(i, 1); 
                if (target.health <= 0) {
                  playSound('pop');
                  setScore(s => s + (target.maxHealth * 10));
                  
                  if (target.imageSrc) {
                    if (target.imageSrc === 'blue.png') {
                      setSymptomsEliminated(prev => ({ ...prev, blue: prev.blue + 1 }));
                    } else if (target.imageSrc === 'green.png') {
                      setSymptomsEliminated(prev => ({ ...prev, green: prev.green + 1 }));
                    } else if (target.imageSrc === 'red.png') {
                      setSymptomsEliminated(prev => ({ ...prev, red: prev.red + 1 }));
                    }
                  }
                  
                  objects.splice(j, 1); 
                } else {
                  playSound('bossHit');
                }
                break;
              }
            }
            if (target.type === 'bonus') {
              const dx = obj.x - target.x;
              const dy = obj.y - target.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < obj.radius + target.radius) {
                target.health -= 1;
                createParticles(obj.x, obj.y, target.color || '#ffd700', target.health <= 0 ? 12 : 5);
                objects.splice(i, 1);
                if (target.health <= 0) {
                  playSound('pop');
                  setScore(s => s + 30);
                  objects.splice(j, 1);
                  const unlocked = hasGrandaxin90UnlockedRef.current;
                  const currentBox = boxTypeRef.current;
                  if (!unlocked) {
                    setShowBonusPopup(true);
                  } else if (currentBox === 'pack') {
                    setBoxType('grandaxin90');
                    setPillsInPack(90);
                  } else {
                    setPillsInPack(90);
                  }
                } else {
                  playSound('bossHit');
                }
                break;
              }
            }
          }
        }

        if (obj.type === 'pill') {
          drawPill(ctx, obj.x, obj.y, obj.radius);
        } else if (obj.type === 'symptom') {
          drawSymptom(ctx, obj, time);
        } else if (obj.type === 'bonus') {
          drawBonus(ctx, obj, time);
        } else if (obj.type === 'particle') {
          ctx.save();
          ctx.globalAlpha = obj.life!;
          ctx.fillStyle = obj.color!;
          ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        if (obj.y < -100) objects.splice(i, 1); 
        
        if (obj.type === 'symptom') {
          const leaked = (obj.side === 'left' && obj.x > canvas.width + obj.radius) || 
                         (obj.side === 'right' && obj.x < -obj.radius);
          if (leaked) {
            playSound('leak');
            const damage = obj.maxHealth * 8;
            const newIntegrity = Math.max(0, integrityRef.current - damage);
            setIntegrity(newIntegrity);
            integrityRef.current = newIntegrity;
            objects.splice(i, 1);
            if (newIntegrity <= 0) {
              setGameOver(true);
              gameOverRef.current = true;
            }
          }
        }
        if (obj.type === 'bonus') {
          const leaked = (obj.side === 'left' && obj.x > canvas.width + obj.radius) || 
                         (obj.side === 'right' && obj.x < -obj.radius);
          if (leaked) objects.splice(i, 1);
        }
      }

      animationId = requestAnimationFrame(update);
    };

    const drawPill = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 12;
      const grad = ctx.createRadialGradient(x-r/3, y-r/3, r/10, x, y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const drawSymptom = (ctx: CanvasRenderingContext2D, obj: GameObject, time: number) => {
      const { x, y, radius: r, color, health, maxHealth, imageSrc } = obj;
      ctx.save();
      
      // Если есть изображение, рисуем его
      if (imageSrc && symptomImagesRef.current[imageSrc]) {
        const img = symptomImagesRef.current[imageSrc];
        const size = r * 2;
        
        // Добавляем свечение
        ctx.shadowColor = color!;
        ctx.shadowBlur = maxHealth > 1 ? 20 : 12;
        
        // Рисуем изображение
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      } else {
        // Fallback на старую отрисовку, если изображение не загружено
        ctx.shadowColor = color!;
        ctx.shadowBlur = maxHealth > 1 ? 20 : 12;
        
        const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        grad.addColorStop(0, color!);
        grad.addColorStop(0.8, color + '66');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;

        ctx.beginPath();
        const points = maxHealth === 3 ? 12 : maxHealth === 2 ? 8 : 6;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const off = Math.sin(time / 200 + i) * (maxHealth * 2.5);
          const px = x + Math.cos(angle) * (r + off);
          const py = y + Math.sin(angle) * (r + off);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
    };

    const drawBonus = (ctx: CanvasRenderingContext2D, obj: GameObject, time: number) => {
      const { x, y, radius: r, color } = obj;
      ctx.save();
      if (bonusImageRef.current) {
        const img = bonusImageRef.current;
        const size = r * 2;
        const glowColor = color || '#ffd700';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 42;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.shadowColor = color || '#ffd700';
        ctx.shadowBlur = 24;
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, '#fffacd');
        grad.addColorStop(0.5, '#ffd700');
        grad.addColorStop(0.9, '#daa520');
        grad.addColorStop(1, 'rgba(218, 165, 32, 0.4)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        const points = 10;
        const maxHealth = obj.maxHealth;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2 + time / 300;
          const off = Math.sin(time / 150 + i) * (maxHealth * 2);
          const px = x + Math.cos(angle) * (r + off);
          const py = y + Math.sin(angle) * (r + off);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    animationId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [isReloading]);

  return (
    <div ref={containerRef} className="relative w-full h-full select-none touch-none bg-[#0a0f1e] overflow-hidden">
      <canvas ref={backgroundCanvasRef} className="absolute inset-0 block w-full h-full z-0" />
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full z-[1]" />
      
      {/* Bio-Integrity bar at the very top */}
      <div className="absolute top-0 left-0 w-full h-2 bg-slate-900/50 border-b border-white/5 overflow-hidden backdrop-blur-sm relative z-10">
        <div 
          className={`h-full transition-all duration-300 ${integrity > 50 ? 'bg-emerald-500' : integrity > 20 ? 'bg-amber-500' : 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'}`}
          style={{ width: `${integrity}%` }}
        />
        <div className="absolute top-3 left-2 text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Био-Целостность: {integrity}%</div>
      </div>

      <div className="absolute top-2 left-0 w-full flex flex-col gap-2 px-3 pointer-events-none z-[20]">
        <div className="flex justify-between items-center gap-2">
          <div className="bg-slate-900/80 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl">
            <p className="text-[8px] text-blue-400 uppercase font-black tracking-widest">Счет</p>
            <p className="text-lg font-mono font-bold text-white tracking-tighter">{score.toString().padStart(5, '0')}</p>
          </div>
          
          <div className="bg-blue-600/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-500/40">
             <p className="text-[8px] text-blue-300 font-bold uppercase tracking-widest">Уровень {level}</p>
          </div>
          
          <button 
            onClick={() => setGameOver(true)}
            className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white pointer-events-auto active:scale-90 transition-all backdrop-blur-md relative z-20"
          >
            <span className="text-base font-bold">✕</span>
          </button>
        </div>
      </div>

      {/* Control Area with Pack Mechanic */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] z-10">
        {/* Animated Pack Wrapper */}
        <div ref={boxAreaRef} className="relative w-full flex items-center justify-center overflow-visible" style={{ minHeight: '80px' }}>
          <div 
            className={`inline-block flex items-center justify-center border border-white/20 ${
              reloadPhase === 'exiting' ? 'opacity-0' : 
              reloadPhase === 'entering' ? 'opacity-0' : 
              'opacity-100'
            }`}
            style={{ 
              transitionProperty: 'all',
              transitionDuration: (reloadPhase === 'exiting' || reloadPhase === 'entering' || (reloadPhase === 'idle' && isReloading)) ? '600ms' : '100ms',
              transitionTimingFunction: (reloadPhase === 'exiting' || reloadPhase === 'entering' || (reloadPhase === 'idle' && isReloading)) ? 'ease-in-out' : 'ease-out',
              transform: (() => {
                if (reloadPhase === 'exiting') {
                  return 'translateX(-150%) rotate(-15deg)';
                }
                if (reloadPhase === 'entering') {
                  // Начинаем с той же позиции, что и exiting заканчивается, но с другой стороны
                  return 'translateX(150%) rotate(15deg)';
                }
                // В состоянии idle применяем смещение и другие трансформации
                const scale = isPulsing && !isReloading ? 0.9 : 1;
                const translateY = isPulsing && !isReloading ? '8px' : '0px';
                return `translateX(${boxOffsetX}px) translateY(${translateY}) scale(${scale})`;
              })()
            }}
          >
            <div className="relative flex items-center justify-center">
              
              {!imgError ? (
                <span
                  className={`inline-flex items-center justify-center ${boxType === 'grandaxin90' ? 'rounded-lg' : ''}`}
                  style={boxType === 'grandaxin90' ? {
                    boxShadow: '0 0 14px rgba(255,230,150,1), 0 0 32px rgba(255,210,100,0.95), 0 0 48px rgba(255,180,80,0.75), 0 15px 35px rgba(0,0,0,0.45)'
                  } : undefined}
                >
                  <img 
                    src={boxType === 'grandaxin90' ? box90Image : packImage} 
                    alt={boxType === 'grandaxin90' ? 'Грандаксин, упаковка 90 таблеток' : 'Pill Pack'} 
                    draggable="false"
                    onDragStart={(e) => e.preventDefault()}
                    onError={() => setImgError(true)}
                    className={`max-h-20 w-auto object-contain select-none ${isReloading ? 'blur-[1px] grayscale-[0.3]' : ''} ${boxType === 'grandaxin90' ? '' : 'drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)]'}`}
                  />
                </span>
              ) : (
                /* High-fidelity CSS Fallback Pack */
                <div className={`w-auto h-20 bg-white rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border-b-[6px] border-slate-200 overflow-hidden flex flex-col justify-center px-6 relative ${isReloading ? 'grayscale' : ''}`}>
                   <div className="absolute top-0 right-0 w-24 h-full bg-blue-600/10 skew-x-[-12deg] translate-x-12"></div>
                   <div className="z-10">
                     <div className="text-slate-900 font-black text-2xl leading-none tracking-tighter uppercase mb-1">АНТИДОТ</div>
                     <div className="flex items-center gap-2">
                        <div className="h-[2px] w-8 bg-blue-600"></div>
                        <span className="text-blue-600 text-[9px] font-black uppercase tracking-[0.2em]">20 Капсул</span>
                     </div>
                   </div>
                   <div className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 border-2 border-slate-100 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 bg-blue-500 rounded-full animate-pulse"></div>
                   </div>
                </div>
              )}
              
              {isReloading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin shadow-lg mb-2"></div>
                  <span className="bg-blue-600/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest backdrop-blur-md">Загрузка упаковки</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center mt-4 px-2">
          <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-full">
            {boxType === 'pack'
              ? [...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-3 h-3 rounded-full border border-white/10 transition-all duration-500 ${i < pillsInPack ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'bg-white/5'}`} 
                  />
                ))
              : [...Array(30)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2.5 h-2.5 rounded-full border border-white/10 transition-all duration-500 ${i < Math.ceil(pillsInPack / 3) ? 'bg-amber-200 shadow-[0_0_6px_rgba(255,200,100,0.5)]' : 'bg-white/5'}`} 
                  />
                ))}
          </div>
        </div>
      </div>

      {/* Full screen tap area - коробка двигается только по горизонтали */}
      <div 
        ref={tapAreaRef}
        onMouseDown={handleBoxInteraction}
        onTouchStart={handleBoxInteraction}
        onTouchEnd={(e) => e.preventDefault()}
        className="absolute inset-0 w-full h-full z-[15] cursor-pointer"
        style={{ 
          pointerEvents: gameOver || isReloading || showBonusPopup ? 'none' : 'auto',
          backgroundColor: 'transparent',
          touchAction: 'manipulation'
        }}
      />

      {/* Попап поверх игры: получена упаковка Грандаксин 90 таблеток */}
      {showBonusPopup && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-50 bg-black/50 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl max-w-[280px] w-full flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-black text-slate-800 tracking-tight leading-tight">
              Поздравляем, вы получаете упаковку препарата Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> 90 таблеток
            </h2>
            <img src={box90Image} alt="Грандаксин, упаковка 90 таблеток" className="max-h-28 w-auto object-contain drop-shadow-md" />
            <button
              onClick={() => {
                hasGrandaxin90UnlockedRef.current = true;
                setBoxType('grandaxin90');
                setPillsInPack(90);
                setShowBonusPopup(false);
              }}
              className="w-full py-2.5 rounded-xl font-black text-base text-white transition-all active:scale-95"
              style={{ fontFamily: "'Comic CAT', sans-serif", backgroundColor: '#0083C1' }}
            >
              Продолжить игру
            </button>
          </div>
        </div>
      )}

      <style>{`
        .instruction-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .instruction-scroll::-webkit-scrollbar {
          display: none;
        }
        @keyframes slideIn {
          from { transform: translateX(100%) rotate(15deg); opacity: 0; }
          to { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes slideInSlow {
          from { transform: translateX(100%) rotate(15deg); opacity: 0; }
          to { transform: translateX(0) rotate(0); opacity: 1; }
        }
      `}</style>

      {gameOver && (
        <div 
          className={`absolute inset-0 flex flex-col items-center p-8 pt-14 text-center z-50 animate-in fade-in duration-500 overflow-y-auto ${showInstructions ? 'justify-start' : 'justify-center'}`}
          style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #75C4E6 100%)' }}
        >
          {!showInstructions ? (
            <button
              onClick={() => setShowInstructions(true)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/20 active:scale-90 transition-all z-20"
            >
              <img src={infoImage} alt="Инструкция" className="w-8 h-8 object-contain" />
            </button>
          ) : (
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/20 active:scale-90 transition-all z-20"
            >
              <img src={backIconImage} alt="Назад" className="w-8 h-8 object-contain" />
            </button>
          )}
          {showInstructions ? (
            <>
              <div className="w-full max-w-md mb-2 flex-shrink-0 px-2">
                <h2 className="text-base font-black text-slate-800 tracking-tight text-left w-full">
                  Краткая инструкция по медицинскому применению лекарственного препарата: Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> (Тофизопам)
                </h2>
              </div>
              <div className="instruction-scroll w-full max-w-md flex-1 min-h-0 overflow-y-auto pt-2 pb-4">
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-[2rem] p-6 space-y-4 shadow-xl shadow-slate-300/30 text-left">
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Фармакотерапевтическая группа:</span> анксиолитические средства, производные бензодиазепина. Код ATX: N05BA23.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Показания к применению.</span> Препарат Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> показан к применению только у взрослых пациентов в возрасте от 18 лет для лечения: психических (невротических) состояний, сопровождающихся эмоциональным напряжением, тревогой, вегетативными расстройствами, апатией, усталостью и подавленным настроением. Алкогольного абстинентного синдрома.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Способ применения и режим дозирования. Взрослые.</span> Обычно рекомендуемая доза: 1–2 таблетки от 1 до 3 раз в день (общая суточная доза от 50 до 300 мг).
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    При нерегулярном применении можно принять 1–2 таблетки. Постепенное повышение дозы обычно не требуется: лечение можно начинать с необходимой дозы, т. к. препарат хорошо переносится и во время его приема обычно не наблюдается уменьшение активности и психического бодрствования.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Способ применения.</span> Таблетки для приема внутрь.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Противопоказания.</span> Гиперчувствительность к тофизопаму, другим производным группы бензодиазепина или к любому из вспомогательных веществ; детский возраст до 18 лет; беременность; период грудного вскармливания; состояния, сопровождающиеся выраженным психомоторным возбуждением; психические нарушения, тревожно-депрессивный синдром с суицидальными тенденциями; острый респираторный дистресс-синдром; дыхательная недостаточность; синдром обструктивного апноэ; кома; шок; миастения; тяжелая печеночная недостаточность; аритмии, синдром удлиненного интервала QT (врожденный и приобретенный), гипокалиемия.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Фертильность, беременность и период грудного вскармливания.</span><br />
                    <span className="font-semibold text-slate-800">Беременность.</span> Тофизопам проникает через плацентарный барьер. Применение этого препарата при беременности противопоказано.<br />
                    <span className="font-semibold text-slate-800">Период грудного вскармливания.</span> Препарат выделяется в грудное молоко, поэтому не рекомендуется его применять во время грудного вскармливания.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Особые меры предосторожности при хранении.</span><br />
                    Храните препарат при температуре от 15 до 25 °C.
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">ДЕРЖАТЕЛЬ РЕГИСТРАЦИОННОГО УДОСТОВЕРЕНИЯ</span><br />
                    ЗАО «Фармацевтический завод ЭГИС» 1106 Будапешт, ул. Керестури, 30–38 Телефон: (36-1) 803-5555 Факс: (36-1) 803-5529 Электронная почта: <a href="mailto:mailbox@egis.hu" className="text-blue-600 underline hover:text-blue-800">mailbox@egis.hu</a> Венгрия
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">Представитель держателя регистрационного удостоверения.</span><br />
                    Представительство ЗАО «Фармацевтический завод ЭГИС» (Венгрия) в Республике Беларусь 220053, г. Минск, пер. Ермака, д. 6А. Контактные телефоны: (017) 380-00-80, (017) 227-35-51 (52), факс (017) 227-35-53 Электронная почта: <a href="mailto:info@egis.by" className="text-blue-600 underline hover:text-blue-800">info@egis.by</a>
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-semibold text-slate-800">НОМЕР РЕГИСТРАЦИОННОГО УДОСТОВЕРЕНИЯ</span> № 000172 ГП-ВY б/с
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
          <div className="w-full max-w-md mb-2 flex-shrink-0 px-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight text-center uppercase w-full">
              Счет игры<br />
              «Грандаксин<span className="align-super" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.5em' }}>®</span> может»
            </h2>
          </div>

          <div className="bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-[2rem] p-4 mb-4 w-full space-y-3 shadow-xl shadow-slate-300/30">
            <div>
              <div className="text-4xl font-mono font-bold text-slate-800 tracking-tighter">{score}</div>
            </div>
            
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Использовано таблеток:</span>
                <span className="text-slate-800 font-mono font-bold text-lg">{totalPillsUsed}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Использовано пачек:</span>
                <span className="text-slate-800 font-mono font-bold text-lg">{Math.ceil(totalPillsUsed / 20)}</span>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">Устранено симптомов:</p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img src={blueImage} alt="Тревога" className="w-8 h-8 object-contain" />
                      <span className="text-slate-700 text-sm font-medium">Тревога:</span>
                    </div>
                    <span className="text-slate-800 font-mono font-bold">{symptomsEliminated.blue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img src={greenImage} alt="Нервозность" className="w-8 h-8 object-contain" />
                      <span className="text-slate-700 text-sm font-medium">Нервозность:</span>
                    </div>
                    <span className="text-slate-800 font-mono font-bold">{symptomsEliminated.green}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img src={redImage} alt="Стресс" className="w-8 h-8 object-contain" />
                      <span className="text-slate-700 text-sm font-medium">Стресс:</span>
                    </div>
                    <span className="text-slate-800 font-mono font-bold">{symptomsEliminated.red}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-700 text-sm font-bold">Всего:</span>
                    <span className="text-slate-800 font-mono font-bold text-lg">{symptomsEliminated.blue + symptomsEliminated.green + symptomsEliminated.red}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-1 mt-4">
            <div className="relative w-full group">
              <div className="absolute -inset-1 bg-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000" />
              <button 
                onClick={resetGame}
                className="relative w-full py-3 text-white rounded-2xl font-black text-xl transition-all active:scale-95 overflow-hidden attention-pulse"
                style={{ fontFamily: "'Comic CAT', sans-serif", backgroundColor: '#0083C1' }}
              >
                <span className="absolute inset-0 shimmer-run pointer-events-none z-0" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)', width: '40%' }} />
                <span className="relative z-10">Начать сначала</span>
              </button>
            </div>
            <span 
              onClick={onExit}
              className="block w-full py-2 text-center text-slate-600 hover:text-slate-800 font-medium text-base cursor-pointer active:opacity-80 transition-colors"
              style={{ fontFamily: "'Comic CAT', sans-serif" }}
            >
              Выйти
            </span>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GameContainer;
