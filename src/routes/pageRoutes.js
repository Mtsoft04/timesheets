import { Router } from 'express';
import { renderCommunity, renderHome, renderSchedule, renderTeams } from '../controllers/pageController.js';

const router = Router();
router.get('/', (req, res) => res.redirect(302, '/schedule'));
router.get('/home', renderHome);
router.get('/schedule', renderSchedule);
router.get('/teams', renderTeams);
router.get('/community', renderCommunity);
export default router;
