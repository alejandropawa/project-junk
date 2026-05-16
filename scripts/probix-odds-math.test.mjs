import assert from "node:assert/strict";
import test from "node:test";

function calculateOddsMovement(openingOdds, currentOdds) {
  if (openingOdds == null || currentOdds == null || openingOdds <= 1 || currentOdds <= 1) {
    return {};
  }
  const oddsMovementPct = ((currentOdds - openingOdds) / openingOdds) * 100;
  const closingLineValuePct = (openingOdds / currentOdds - 1) * 100;
  return {
    oddsMovementPct: Math.round(oddsMovementPct * 1000) / 1000,
    movedAgainstModel: closingLineValuePct < 0,
    movedWithModel: closingLineValuePct > 0,
    closingLineValuePct: Math.round(closingLineValuePct * 1000) / 1000,
  };
}

test("positive CLV when published odds beat shorter closing odds", () => {
  const r = calculateOddsMovement(2.1, 1.9);
  assert.equal(r.movedWithModel, true);
  assert.equal(r.movedAgainstModel, false);
  assert.equal(r.oddsMovementPct, -9.524);
  assert.equal(r.closingLineValuePct, 10.526);
});

test("negative CLV when closing odds drift against the pick", () => {
  const r = calculateOddsMovement(1.8, 2.1);
  assert.equal(r.movedWithModel, false);
  assert.equal(r.movedAgainstModel, true);
  assert.equal(r.oddsMovementPct, 16.667);
  assert.equal(r.closingLineValuePct, -14.286);
});

