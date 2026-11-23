import { Router } from 'express';
import { renderCommunity, renderHome, renderSchedule, renderTeams } from '../controllers/pageController.js';

const router = Router();
router.get('/', renderHome);
router.get('/schedule', renderSchedule);
router.get('/teams', renderTeams);
router.get('/community', renderCommunity);
export default router;
