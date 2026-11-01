import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leaderboardRouter from "./leaderboard";
import authRouter from "./auth";
import quizReportsRouter from "./quiz-reports";
import profileRouter from "./profile";
import gamificationRouter from "./gamification";
import flagsRouter from "./flags";
import adminRouter from "./admin";
import subjectsRouter from "./subjects";
import feedbacksRouter from "./feedbacks";
import vaultRouter from "./vault";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leaderboardRouter);
router.use(authRouter);
router.use(quizReportsRouter);
router.use(profileRouter);
router.use(gamificationRouter);
router.use(flagsRouter);
router.use(adminRouter);
router.use(subjectsRouter);
router.use(feedbacksRouter);
router.use(vaultRouter);

export default router;
