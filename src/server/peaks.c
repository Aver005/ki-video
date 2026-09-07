/* Пики громкости: максимум модуля по корзинам int16 → 0..255. Без заголовков: компилирует TinyCC в Bun. */
typedef short ki_i16;
typedef unsigned char ki_u8;

int ki_peaks(const ki_i16 *samples, int count, int bucket, ki_u8 *out, int outCount) {
  int written = 0;
  for (int start = 0; start < count && written < outCount; start += bucket) {
    int end = start + bucket;
    if (end > count) end = count;
    int peak = 0;
    for (int i = start; i < end; i++) {
      int v = samples[i];
      if (v < 0) v = -v;
      if (v > peak) peak = v;
    }
    /* -32768 даёт 32768 >> 7 = 256: прижимаем к диапазону байта. */
    if (peak > 32767) peak = 32767;
    out[written++] = (ki_u8)(peak >> 7);
  }
  return written;
}
