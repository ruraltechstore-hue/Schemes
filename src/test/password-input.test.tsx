import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";

function TestPasswordForm({ onSubmit }: { onSubmit?: (e: React.FormEvent) => void }) {
  const [val, setVal] = useState("");
  return (
    <form onSubmit={onSubmit || ((e) => e.preventDefault())}>
      <label htmlFor="test-password">Password</label>
      <PasswordInput
        id="test-password"
        name="password"
        placeholder="Enter your password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        required
      />
      <button type="submit">Submit</button>
    </form>
  );
}

describe("PasswordInput Component — Eye Icon Show/Hide Visibility", () => {
  it("renders with type='password' by default (masked)", () => {
    render(<TestPasswordForm />);
    const input = screen.getByLabelText("Password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("displays an eye icon with 'Show text' aria-label when password is hidden", () => {
    render(<TestPasswordForm />);
    const toggleBtn = screen.getByTestId("toggle-password-button");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-label", "Show text");
    expect(toggleBtn).toHaveAttribute("title", "Show password");
    expect(toggleBtn).toHaveAttribute("type", "button");
  });

  it("toggles to type='text' when the eye icon is clicked", () => {
    render(<TestPasswordForm />);
    const input = screen.getByLabelText("Password");
    const toggleBtn = screen.getByTestId("toggle-password-button");

    expect(input).toHaveAttribute("type", "password");

    // Click to show password
    fireEvent.click(toggleBtn);

    expect(input).toHaveAttribute("type", "text");
    expect(toggleBtn).toHaveAttribute("aria-label", "Hide text");
    expect(toggleBtn).toHaveAttribute("title", "Hide password");
  });

  it("toggles back to type='password' when clicked again", () => {
    render(<TestPasswordForm />);
    const input = screen.getByLabelText("Password");
    const toggleBtn = screen.getByTestId("toggle-password-button");

    // Click to show
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "text");

    // Click to hide again
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "password");
    expect(toggleBtn).toHaveAttribute("aria-label", "Show text");
    expect(toggleBtn).toHaveAttribute("title", "Show password");
  });

  it("does not submit the enclosing form when the eye button is clicked", () => {
    let submitted = false;
    render(<TestPasswordForm onSubmit={(e) => { e.preventDefault(); submitted = true; }} />);

    const toggleBtn = screen.getByTestId("toggle-password-button");
    fireEvent.click(toggleBtn);

    expect(submitted).toBe(false);
  });

  it("allows entering and updating text properly", () => {
    render(<TestPasswordForm />);
    const input = screen.getByLabelText("Password");

    fireEvent.change(input, { target: { value: "SuperSecret123!" } });
    expect(input).toHaveValue("SuperSecret123!");
  });

  it("disables both the input and the toggle button when disabled prop is true", () => {
    render(
      <PasswordInput
        aria-label="Disabled Password"
        disabled
        value="secret"
        readOnly
      />
    );
    const input = screen.getByLabelText("Disabled Password");
    const toggleBtn = screen.getByTestId("toggle-password-button");

    expect(input).toBeDisabled();
    expect(toggleBtn).toBeDisabled();
  });
});
