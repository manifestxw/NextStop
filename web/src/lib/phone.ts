// Display only: "+962791234567" → "+962 79 123 4567". The server decides what a valid number is.
export const fmtPhone = (p: string) => p.replace(/^\+962(\d{2})(\d{3})(\d{4})$/, '+962 $1 $2 $3');
