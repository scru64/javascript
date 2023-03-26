export const assert = (expression, message = "") => {
  if (!expression) {
    throw new Error("Assertion failed" + (message ? ": " + message : ""));
  }
};

export const assertThrows = (fn, error = undefined, message = "") => {
  let caught = false;
  try {
    fn();
  } catch (e) {
    if (error === undefined || e instanceof error) {
      caught = true;
    }
  }
  assert(caught, message);
};
