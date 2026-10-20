import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnimationPreset =
    | 'pulse-glow'
    | 'rotate-slow'
    | 'bounce-soft'
    | 'float-subtle'
    | 'spin-hover'
    | 'shake-hover'
    | 'scale-hover'
    | 'none';

interface AnimatedIconProps {
    icon: LucideIcon;
    preset?: AnimationPreset;
    className?: string;
    size?: number;
    strokeWidth?: number;
}

export function AnimatedIcon({
    icon: Icon,
    preset = 'none',
    className,
    size,
    strokeWidth
}: AnimatedIconProps) {
    const animationClass = preset !== 'none' ? `icon-${preset}` : '';

    return (
        <div className={cn('inline-flex gpu-accelerate', animationClass, className)}>
            <Icon size={size} strokeWidth={strokeWidth} />
        </div>
    );
}
