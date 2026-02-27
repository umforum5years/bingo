import { Component, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fireworks',
  imports: [CommonModule],
  templateUrl: './fireworks.component.html',
  styleUrl: './fireworks.component.css',
})
export class FireworksComponent {
  readonly show = input<boolean>(false);
  readonly finished = output<void>();

  readonly particles: Particle[][] = [];
  readonly positions: { x: number; y: number }[] = [];

  constructor() {
    // Create multiple firework bursts at different positions
    for (let i = 0; i < 8; i++) {
      this.positions.push({
        x: 10 + (i % 3) * 40,
        y: 15 + Math.floor(i / 3) * 35,
      });
      this.particles.push(this.createFireworkParticles());
    }

    // Auto-finish after animation duration
    effect(() => {
      if (this.show()) {
        setTimeout(() => {
          this.finished.emit();
        }, 4000);
      }
    });
  }

  private createFireworkParticles(): Particle[] {
    const particles: Particle[] = [];
    const particleCount = 50 + Math.random() * 30;
    const colors = [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00',
      '#ff00ff', '#00ffff', '#ffa500', '#ff1493',
      '#00ffa3', '#fd5900', '#ff0040', '#8000ff',
      '#ff4500', '#00ced1', '#ff69b4', '#7fff00'
    ];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 5 + Math.random() * 5;
      particles.push({
        x: 50,
        y: 50,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 4,
        decay: 0.015 + Math.random() * 0.01,
        gravity: 0.15,
      });
    }

    return particles;
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  decay: number;
  gravity: number;
}
