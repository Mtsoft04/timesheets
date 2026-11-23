const render = (page, active, title) => (req, res) => res.render(`pages/${page}`, { title, active });

export const renderHome = render('home', 'home', 'Timesheets');
export const renderSchedule = (req, res) => res.render('pages/schedule', { title: 'Lịch cá nhân', initialView: 'me' });
export const renderTeams = (req, res) => res.render('pages/teams', { title: 'Lịch đội nhóm', initialView: 'team' });
export const renderCommunity = (req, res) => res.render('pages/community', { title: 'Cộng đồng', initialView: 'posts' });
