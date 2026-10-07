import Router from "express";
import { handleLoginQuery, handleRegistrationQuery, invalidateUserSession } from "../auth";

export const authRouter = Router();

authRouter.post("/login", handleLoginQuery);
authRouter.post("/register", handleRegistrationQuery);
authRouter.delete("/sessions", invalidateUserSession);
