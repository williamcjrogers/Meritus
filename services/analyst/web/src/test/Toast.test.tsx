import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../components/Toast'

function Controls() {
  const notify = useToast()
  return <><button onClick={() => notify('Saved successfully', 'success')}>Save fixture</button><button onClick={() => notify('Review this warning', 'warning')}>Show warning</button></>
}

afterEach(() => vi.useRealTimers())

describe('notifications', () => {
  it('expires success notifications after six seconds and pauses expiry while their control is focused', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Controls /></ToastProvider>)
    fireEvent.click(screen.getByText('Save fixture'))
    act(() => vi.advanceTimersByTime(5_999))
    expect(screen.getByText('Saved successfully')).toBeVisible()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Save fixture'))
    const dismiss = screen.getByRole('button', { name: 'Dismiss notification' })
    fireEvent.mouseEnter(dismiss)
    fireEvent.focus(dismiss)
    fireEvent.mouseLeave(dismiss)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByText('Saved successfully')).toBeVisible()
    fireEvent.blur(dismiss)
    act(() => vi.advanceTimersByTime(6_000))
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument()
  })

  it('retains a warning until the analyst dismisses it', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Controls /></ToastProvider>)
    fireEvent.click(screen.getByText('Show warning'))
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Review this warning')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Review this warning')).not.toBeInTheDocument()
  })
})
