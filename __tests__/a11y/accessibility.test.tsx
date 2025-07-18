import { render, screen } from '@testing-library/react'
import React from 'react'

// Simple test component to verify accessibility
const TestComponent = () => {
  return (
    <div>
      <button aria-label="Test button">Click me</button>
      <p>Test content</p>
    </div>
  )
}

describe('Accessibility Tests', () => {
  test('basic accessibility test passes', () => {
    render(<TestComponent />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label')
    
    const text = screen.getByText('Test content')
    expect(text).toBeInTheDocument()
  })

  test('button is keyboard accessible', () => {
    render(<TestComponent />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    // Simulate keyboard focus
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  test('aria-label is present on interactive elements', () => {
    render(<TestComponent />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Test button')
  })
})