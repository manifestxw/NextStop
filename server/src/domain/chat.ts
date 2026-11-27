// Chat masking runs BEFORE storing (ARCH §9.4, SPEC §3.11): links, then phone numbers → •••.
const LINK = /(https?:\/\/|www\.)\S+|\b\S+\.(com|net|org|jo|io|me|ly)\b\S*/gi;
const PHONE = /(?:\d[\s-]?){7,}/g;

export const maskChat = (text: string): string => text.replace(LINK, '•••').replace(PHONE, '•••');
