export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|sign-in|robots.txt|_next/static|_next/image|favicon.ico).*)",
  ],
};
