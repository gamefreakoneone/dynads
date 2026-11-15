import test from "node:test";
import assert from "node:assert/strict";
import { isMovementReport, nextEnergy, stageForEnergy, nextStageAtChunk } from "../lib/cheer/energy.ts";

test("reject malformed movement reports from the tool", () => {
  for (const value of [null, {}, { intensity: NaN, person_visible: true, observation: "jumping" },
    { intensity: 101, person_visible: true, observation: "jumping" },
    { intensity: 80, person_visible: "yes", observation: "jumping" }]) assert.equal(isMovementReport(value), false);
  assert.equal(isMovementReport({ intensity: 85, person_visible: true, observation: "Repeated jumps" }), true);
});
test("stillness and absent people cannot charge the team", () => {
  assert.equal(nextEnergy(0, { intensity: 0, person_visible: true, observation: "Still" }), 0);
  assert.equal(nextEnergy(50, { intensity: 100, person_visible: false, observation: "No person" }), 40);
});
test("sustained movement charges progressively, within bounds", () => {
  let energy = 0;
  const report = { intensity: 95, person_visible: true, observation: "Jumping" };
  energy = nextEnergy(energy, report);
  assert.equal(energy, 18);
  assert.equal(stageForEnergy(energy, 95), "tired");
  energy = nextEnergy(energy, report);
  assert.equal(stageForEnergy(energy, 95), "waking");
  for (let i = 0; i < 20; i++) energy = nextEnergy(energy, report);
  assert.equal(energy, 100);
  assert.equal(stageForEnergy(energy, 95), "jumping");
});
test("finale requires current vigorous movement, not just stored energy", () => {
  assert.equal(stageForEnergy(100, 10), "energized");
  assert.equal(stageForEnergy(84, 100), "energized");
  assert.equal(stageForEnergy(85, 70), "jumping");
});
test("steering progresses through every stage and respects chunk boundaries", () => {
  assert.equal(nextStageAtChunk("tired", 100, 95, 1), "tired");
  assert.equal(nextStageAtChunk("tired", 100, 95, 2), "waking");
  assert.equal(nextStageAtChunk("waking", 100, 95, 2), "energized");
  assert.equal(nextStageAtChunk("energized", 100, 95, 2), "jumping");
  assert.equal(nextStageAtChunk("jumping", 0, 0, 2), "jumping");
  assert.equal(nextStageAtChunk("jumping", 0, 0, 3), "running");
  assert.equal(nextStageAtChunk("running", 0, 0, 4), "running");
  assert.equal(nextStageAtChunk("running", 0, 0, 5), "complete");
});
test("before the finale, stopping movement lets the team rest", () => {
  assert.equal(nextStageAtChunk("energized", 10, 0, 2), "tired");
});
