"use client";

import React, { useState, useEffect } from 'react';
import { TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameTimerProps {
  initialTime: number; // in seconds
  onTimeUp: () => void;
}

export function GameTimer({ initialTime, onTimeUp }: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    setTimeLeft(initialTime); // Reset timer when initialTime changes (e.g. new question)
  }, [initialTime]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const timeAlmostUp = timeLeft <= 60 && timeLeft > 0; // Less than 1 minute

  return (
    <div className={cn(
        "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium tabular-nums",
        timeLeft === 0 ? "bg-destructive text-destructive-foreground" :
        timeAlmostUp ? "bg-yellow-500 text-yellow-foreground animate-pulse" :
        "bg-primary/10 text-primary"
    )}>
      <TimerIcon className="h-4 w-4" />
      <span>{formatTime(timeLeft)}</span>
    </div>
  );
}
