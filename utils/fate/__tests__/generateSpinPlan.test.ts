import { generateSpinPlan } from '../generateSpinPlan';

describe('generateSpinPlan', () => {
  it('with 0 fakeouts produces exactly 2 steps (main + final)', () => {
    const plan = generateSpinPlan(4, 0, { forceFakeouts: 0 });
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe('main');
    expect(plan.steps[1].type).toBe('final');
    expect(plan.fakeoutCount).toBe(0);
  });

  it('with 3 fakeouts produces 8 steps (main + 3*(slow+push) + final)', () => {
    const plan = generateSpinPlan(4, 1, { forceFakeouts: 3 });
    expect(plan.steps).toHaveLength(8);
    expect(plan.steps[0].type).toBe('main');
    expect(plan.steps[1].type).toBe('fake-slow');
    expect(plan.steps[2].type).toBe('fake-push');
    expect(plan.steps[3].type).toBe('fake-slow');
    expect(plan.steps[4].type).toBe('fake-push');
    expect(plan.steps[5].type).toBe('fake-slow');
    expect(plan.steps[6].type).toBe('fake-push');
    expect(plan.steps[7].type).toBe('final');
    expect(plan.fakeoutCount).toBe(3);
  });

  it('final rotation modulo 360 lands on winner slice', () => {
    for (let nameCount = 3; nameCount <= 10; nameCount++) {
      for (let winnerIdx = 0; winnerIdx < nameCount; winnerIdx++) {
        const plan = generateSpinPlan(nameCount, winnerIdx, { forceFakeouts: 0 });
        const sliceAngle = 360 / nameCount;
        const winnerCenter = winnerIdx * sliceAngle + sliceAngle / 2;
        const pointerAt = (360 - (plan.finalRotation % 360) + 360) % 360;
        const diff = Math.abs(pointerAt - winnerCenter);
        const wrappedDiff = Math.min(diff, 360 - diff);
        expect(wrappedDiff).toBeLessThan(sliceAngle / 2 + 0.01);
      }
    }
  });

  it('winnerIndex is preserved in the plan', () => {
    const plan = generateSpinPlan(5, 3, { forceFakeouts: 1 });
    expect(plan.winnerIndex).toBe(3);
  });

  it('all step rotations are monotonically increasing', () => {
    const plan = generateSpinPlan(6, 2, { forceFakeouts: 2 });
    let prev = 0;
    for (const step of plan.steps) {
      expect(step.toRotation).toBeGreaterThan(prev);
      prev = step.toRotation;
    }
  });

  it('works correctly over 100 random runs', () => {
    for (let i = 0; i < 100; i++) {
      const nameCount = 3 + Math.floor(Math.random() * 8);
      const winnerIdx = Math.floor(Math.random() * nameCount);
      const plan = generateSpinPlan(nameCount, winnerIdx);

      expect(plan.winnerIndex).toBe(winnerIdx);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.finalRotation).toBe(plan.steps[plan.steps.length - 1].toRotation);

      // Verify landing
      const sliceAngle = 360 / nameCount;
      const winnerCenter = winnerIdx * sliceAngle + sliceAngle / 2;
      const pointerAt = (360 - (plan.finalRotation % 360) + 360) % 360;
      const diff = Math.abs(pointerAt - winnerCenter);
      const wrappedDiff = Math.min(diff, 360 - diff);
      expect(wrappedDiff).toBeLessThan(sliceAngle / 2 + 0.01);
    }
  });
});
