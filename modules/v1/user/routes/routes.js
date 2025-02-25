const User = require("../controllers/user");
const middleware = require("../../../../middlewares/data_validation");

const user = (app) =>{
    app.post("/v1/user/signup", User.signup);
    app.post("/v1/user/login", User.login);
    app.post("/v1/user/logout", User.logout);

    app.post("/v1/user/forgot-pass", User.forgot_password);
    app.post("/v1/user/reset-pass", User.reset_password);
    app.post("/v1/user/complete-profile", User.complete_profile);
    app.post("/v1/user/change-password", User.change_pswd);
    app.post("/v1/user/edit-profile", User.edit_profile);
    app.post("/v1/user/contact-us", User.contact_us);

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
    app.post("/v1/user/save-post", User.save_post);
    app.post("/v1/user/show-saved-post", User.show_saved_post);

    app.post("/v1/user/add-comment", User.add_comment);
    app.post("/v1/user/show-post-comment", User.show_post_comments);
    app.post("/v1/user/delete-post", User.delete_posts);
    app.post("/v1/user/report-profile", User.report_profile);
    app.post("/v1/user/report-post", User.report_post);

}

module.exports = user;