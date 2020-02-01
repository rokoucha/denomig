import {
  Transformer,
  ok,
  error,
  ValidationError,
} from 'https://cdn.jsdelivr.net/gh/rokoucha/transform-ts@master/mod.ts'

class DoesNotNumericStringError extends Error {
  constructor(readonly text: string) {
    super(`string "${text}" does not numeric string.`)
    this.name = 'DoesNotNumericStringError'
  }
}

export const $numericString = Transformer.from<string, number>(text =>
  Number.isNaN(Number(text))
    ? error(ValidationError.from(new DoesNotNumericStringError(text)))
    : ok(Number(text)),
)
