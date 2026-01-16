/**
 * Audio Queue Manager
 * Prevents audio interruptions by queueing speech synthesis
 */

export class AudioQueueManager {
  private queue: Array<{text: string; resolve: () => void}> = []
  private isProcessing = false
  private currentUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    // Cancel all speech on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.clear())
    }
  }

  /**
   * Add audio to queue and play when ready
   */
  async speak(text: string, lang: string = 'en-US', rate: number = 1.2): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ text, resolve })
      if (!this.isProcessing) {
        this.processQueue(lang, rate)
      }
    })
  }

  /**
   * Process audio queue sequentially
   */
  private async processQueue(lang: string, rate: number): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) continue

      await this.speakNow(item.text, lang, rate)
      item.resolve()
    }

    this.isProcessing = false
  }

  /**
   * Speak immediately (internal use only)
   */
  private speakNow(text: string, lang: string, rate: number): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Cancel any ongoing speech
        window.speechSynthesis?.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        utterance.rate = rate
        this.currentUtterance = utterance

        utterance.onend = () => {
          this.currentUtterance = null
          resolve()
        }

        utterance.onerror = () => {
          this.currentUtterance = null
          resolve()
        }

        window.speechSynthesis.speak(utterance)

        // Fallback timeout
        setTimeout(() => {
          if (this.currentUtterance === utterance) {
            this.currentUtterance = null
            resolve()
          }
        }, 30000)
      } catch (err) {
        console.error('Speech synthesis error:', err)
        resolve()
      }
    })
  }

  /**
   * Clear all queued audio
   */
  clear(): void {
    this.queue = []
    this.isProcessing = false
    window.speechSynthesis?.cancel()
    this.currentUtterance = null
  }

  /**
   * Check if audio is currently playing
   */
  isSpeaking(): boolean {
    return window.speechSynthesis?.speaking || false
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length
  }
}

// Export singleton instance
export const audioQueue = new AudioQueueManager()
