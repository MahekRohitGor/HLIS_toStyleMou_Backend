const User = require("../controllers/user");
const middleware = require("../../../../middlewares/data_validation");

const user = (app) =>{
    app.post("/v1/user/signup", User.signup);
    app.post("/v1/user/login", User.login);
    app.post("/v1/user/logout", User.logout);

    app.post("/v1/user/forgot-pass", User.forgot_password);
    app.post("/v1/user/reset-pass", User.reset_password);
    app.post("/v1/user/complete-profile", User.complete_profile);

    app.post("/v1/user/trending-posts", User.trending_posts);
    app.post("/v1/user/add-post", User.add_post);
    app.post("/v1/user/get-rank", User.get_post_ranks);
    app.post("/v1/user/get-notification", User.get_notifications);
    app.post("/v1/user/follow-user", User.follow_user);
    app.post("/v1/user/rate-post", User.rate_post);
    app.post("/v1/user/view-profile", User.get_profile);
    app.post("/v1/user/view-profile-other/:id", User.get_other_profile);
    app.post("/v1/user/filter", User.filter);
    app.post("/v1/user/get-followers", User.get_followers);
    app.post("/v1/user/get-following", User.get_following);

}

module.exports = user;