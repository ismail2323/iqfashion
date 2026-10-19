export class IsHatasi extends Error {
  constructor(
    mesaj: string,
    public durum: 400 | 403 | 404 | 409 | 422 | 429 | 502 = 400,
  ) {
    super(mesaj);
  }
}
