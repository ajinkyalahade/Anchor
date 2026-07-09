import { CheckCircle2, Circle } from 'lucide-react';
import { Card } from './ui';

interface Step {
  label: string;
  est_minutes: number;
  first: boolean;
  completed?: boolean;
}

interface TaskDecomposerProps {
  steps: Step[];
  whyFirstStepMatters: string;
  onToggleStep: (index: number) => void;
}

export default function TaskDecomposer({ steps, whyFirstStepMatters, onToggleStep }: TaskDecomposerProps) {
  if (steps.length === 0) return null;

  const firstStep = steps[0];
  const remainingSteps = steps.slice(1);

  return (
    <div className="space-y-4">
      {/* First step is highlighted significantly per PRD */}
      <Card padding="md" variant="surface" className="border-l-4 border-l-[var(--color-accent-focus)] bg-[color-mix(in_srgb,var(--color-accent-focus)_5%,transparent)]">
        <div className="flex items-start gap-3">
          <button onClick={() => onToggleStep(0)} className="mt-1 flex-shrink-0 text-[var(--color-accent-focus)]">
            {firstStep.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
          </button>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-[var(--color-accent-focus)] uppercase mb-1 block">Start here (2 min max)</span>
            <h3 className={`font-semibold text-lg ${firstStep.completed ? 'line-through opacity-50' : ''}`}>
              {firstStep.label}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-2 italic">
              "{whyFirstStepMatters}"
            </p>
          </div>
        </div>
      </Card>

      {/* Remaining steps */}
      {remainingSteps.length > 0 && (
        <Card padding="md" variant="surface">
          <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Next steps</h4>
          <div className="space-y-3">
            {remainingSteps.map((step, index) => {
              const actualIndex = index + 1;
              return (
                <div key={actualIndex} className="flex items-start gap-3">
                  <button onClick={() => onToggleStep(actualIndex)} className="mt-0.5 flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-accent-focus)] transition-colors">
                    {step.completed ? <CheckCircle2 size={20} className="text-[var(--color-accent-focus)]" /> : <Circle size={20} />}
                  </button>
                  <div className={`flex-1 ${step.completed ? 'line-through opacity-50 text-[var(--color-text-muted)]' : ''}`}>
                    <span className="text-[var(--color-text-primary)]">{step.label}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">~{step.est_minutes}m</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
