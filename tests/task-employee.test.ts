import { test } from "node:test";
import assert from "node:assert/strict";
import { visitEmployeeIdFromTasks } from "../lib/task-employee";

test("alle opgaver bundet til samme medarbejder → besøgets medarbejder", () => {
  assert.equal(visitEmployeeIdFromTasks([{ employeeId: 7 }, { employeeId: 7 }]), 7);
});

test("én enkelt bundet opgave → besøgets medarbejder", () => {
  assert.equal(visitEmployeeIdFromTasks([{ employeeId: 3 }]), 3);
});

test("ingen bundne opgaver → null (almindelig planlægning)", () => {
  assert.equal(visitEmployeeIdFromTasks([{ employeeId: null }, { employeeId: null }]), null);
  assert.equal(visitEmployeeIdFromTasks([]), null);
});

test("forskellige medarbejdere på linjerne → null (besøget kan ikke have én)", () => {
  assert.equal(visitEmployeeIdFromTasks([{ employeeId: 7 }, { employeeId: 9 }]), null);
});

test("delvist bundet (én ubundet) → null", () => {
  assert.equal(visitEmployeeIdFromTasks([{ employeeId: 7 }, { employeeId: null }]), null);
});
