const common = require("../../../../utilities/common");
const database = require("../../../../config/database");
const response_code = require("../../../../utilities/response-error-code");
const md5 = require("md5");

class userModel {
    async signup(request_data, callback) {
        try {
            console.log(request_data);
            if (!request_data.email_id || !request_data.user_name || !request_data.code_id || !request_data.mobile_number || !request_data.passwords) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "Missing required fields"
                });
            }

            const data = {
                user_name: request_data.user_name,
                email_id: request_data.email_id,
                code_id: request_data.code_id,
                mobile_number: request_data.mobile_number,
                passwords: md5(request_data.passwords)
            };

            const device_data = {
                device_type: request_data.device_type,
                device_token: request_data.device_token,
                os_version: request_data.os_version,
                app_version: request_data.app_version,
                time_zone: request_data.time_zone
            };

            const checkUserExistsQuery = "SELECT * FROM tbl_user WHERE email_id = ?";
            const [existingUsers] = await database.query(checkUserExistsQuery, [data.email_id]);
            console.log(existingUsers);
            console.log(existingUsers.length)

            if (existingUsers.length > 0) {
                const user_data_ = existingUsers[0];

                if (existingUsers.length > 1) {
                    await database.query(
                        "UPDATE tbl_user SET is_deleted = 1 WHERE user_id = ?",
                        [existingUsers[1]?.user_id]
                    );
                }

                const otp_obj = request_data.otp ? { otp: request_data.otp } : {};

                common.updateUserInfo(user_data_.user_id, otp_obj, (error, updateUser) => {
                    if (error) {
                        console.log("Error here: ", error);
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: error
                        });
                    }
                    return callback({
                        code: response_code.SUCCESS,
                        message: "User Signed up",
                        data: updateUser
                    });
                });

            } else {
                const [insertResult] = await database.query("INSERT INTO tbl_user SET ?", data);
                const userId = insertResult.insertId;
                await this.enterOtp(userId);

                await database.query(
                    "INSERT INTO tbl_device_info (device_type, time_zone, device_token, os_version, app_version, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    [device_data.device_type, device_data.time_zone, device_data.device_token, device_data.os_version, device_data.app_version, userId]
                );

                common.getUserDetail(userId, userId, async (err, userInfo) => {
                    try {
                        if (err) {
                            return callback({
                                code: response_code.OPERATION_FAILED,
                                message: err
                            });
                        }

                        if (userInfo.is_profile_completed === 1) {
                            
                            const userToken = common.generateToken(40);
                            const deviceToken = common.generateToken(40);

                            
                            await Promise.all([
                                database.query("UPDATE tbl_user SET token = ? WHERE user_id = ?", [userToken, userId]),
                                database.query("UPDATE tbl_device_info SET device_token = ? WHERE user_id = ?", [deviceToken, userId])
                            ]);

                            userInfo.token = userToken;
                            userInfo.device_token = deviceToken;

                            return callback({
                                code: response_code.SUCCESS,
                                message: "User Signed Up Successfully... Verification Pending",
                                data: userInfo
                            });
                        } else {
                            return callback({
                                code: response_code.SUCCESS,
                                message: "User Signed Up Successfully... Verification and Profile Completion is Pending",
                                data: userInfo
                            });
                        }
                    } catch (tokenError) {
                        console.error("Token update error:", tokenError);
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: "Error updating tokens"
                        });
                    }
                });
            }

        } catch (error) {
            console.error("Signup error:", error);
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "An error occurred during signup"
            });
        }
    }

    async enterOtp(user_id){
        const otp = common.generateOtp(4);
        const insertOtpQuery = "INSERT INTO tbl_otp (user_id, otp) VALUES (?, ?)";
        await database.query(insertOtpQuery, [user_id, otp]);
        console.log("OTP sent to user_id:", user_id, "OTP:", otp);
    }

    async verify(request_data, callback){
        const { user_id, otp } = request_data;
        var verifyOtpQuery = "UPDATE tbl_user u INNER JOIN tbl_otp o ON u.user_id = o.user_id SET u.is_verify = 1 WHERE u.user_id = ? AND o.otp = ?";
        try {
            const [result] = await database.query(verifyOtpQuery, [user_id, otp]);
            if (result.affectedRows > 0) {
                return callback({
                    code: response_code.SUCCESS,
                    message: "User verified successfully"
                });
            } else {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Invalid OTP or user not found"
                });
            }
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error verifying OTP"
            });
        }
    }

    async login(request_data, callback){
        const user_data = {};
        if(request_data.email_id != undefined && request_data.email_id != ""){
            user_data.email_id = request_data.email_id;
        }
        if(request_data.mobile_number != undefined && request_data.mobile_number != ""){
            user_data.mobile_number = request_data.mobile_number;
        }
        if(request_data.passwords != undefined){
            user_data.passwords = md5(request_data.passwords);
        }

        var selectUserWithCred = "SELECT * FROM tbl_user WHERE (email_id = ? AND passwords = ?) or (mobile_number = ? and passwords = ?)";
        var params = [user_data.email_id, user_data.passwords, user_data.mobile_number, user_data.passwords];

        console.log(user_data);

        try{
            const [status] = await database.query(selectUserWithCred, params);

            console.log("Status: ", status);
            console.log(status.length);

            if (status.length === 0) {
                console.log(status.length);
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "No User Found"
                });
            }

            const user_id = status[0].user_id;
            console.log(user_id);

            const token = common.generateToken(40);
            // console.log(token);
            const updateTokenQuery = "UPDATE tbl_user SET token = ?, is_login = 1 WHERE user_id = ?";
            await database.query(updateTokenQuery, [token, user_id]);

            const device_token = common.generateToken(40);
            const updateDeviceToken = "UPDATE tbl_device_info SET device_token = ? WHERE user_id = ?";
            await database.query(updateDeviceToken, [device_token, user_id]);

            common.getUserDetailLogin(user_id, (err, userInfo)=>{
                console.log("getUserDetailLogin callback:", err, userInfo);
                if(err){
                    console.log("Error here", err);
                    return callback({
                        code: response_code.OPERATION_FAILED,
                        message: "Some Error"
                    });
                }
                else{
                    userInfo.token = token;
                    userInfo.device_token = device_token;
                    return callback({
                        code: response_code.SUCCESS,
                        message: "User Signed in Successfully",
                        data: userInfo
                    });

                }
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "SOME ERROR IN LOGIN"
            });
        }
    }

    async logout(request_data, callback){
        try{
            const user_id = request_data.user_id;
            var select_user_query = "SELECT * FROM tbl_user WHERE user_id = ? and is_login = 1";
            const [info] = await database.query(select_user_query, [user_id]);
            if(info.length > 0){
                const updateDeviceTokenQuery = "UPDATE tbl_device_info SET device_token = '', updated_at = NOW() WHERE user_id = ?";
            const updateTokenQuery = "UPDATE tbl_user SET token = '', is_login = 0 WHERE user_id = ?";
    
            await Promise.all([
                database.query(updateDeviceTokenQuery, [user_id]),
                database.query(updateTokenQuery, [user_id])
            ]);
    
            const getUserQuery = "SELECT user_id, user_name, email_id FROM tbl_user WHERE user_id = ?";
            const [updatedUser] = await database.query(getUserQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: "Logout successful",
                data: updatedUser[0]
            });

            } else{
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Either user not found or already logged out..."
                });
            }

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "Some error Occured...",
                data: error
            })
        }

    }

    async forgot_password(requested_data, callback) {
        const { email_id } = requested_data;
        
        if (!email_id) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "Email ID is required"
            });
        }
        
        try {
            const userQuery = "SELECT * FROM tbl_user WHERE email_id = ?";
            const [user] = await database.query(userQuery, [email_id]);
            
            if (!user.length) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "User not found"
                });
            }
            
            const reset_token = common.generateToken(10);
            const expires_at = new Date(Date.now() + 3600000);
            
            const insertTokenQuery = `INSERT INTO tbl_forgot_password (email_id, reset_token, expires_at) VALUES (?, ?, ?)`;
            await database.query(insertTokenQuery, [email_id, reset_token, expires_at]);
            
            return callback({
                code: response_code.SUCCESS,
                message: "Password reset token sent successfully"
            });
            
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error in forgot password process"
            });
        }
    }

    async reset_password(requested_data, callback) {
        const { reset_token, new_password } = requested_data;
    
        if (!reset_token || !new_password) {
            return callback({
                code: response_code.INVALID_REQUEST,
                message: "Reset token and new password are required"
            });
        }
    
        try {
            const selectTokenQuery = `
                SELECT email_id FROM tbl_forgot_password 
                WHERE reset_token = ? AND is_active = 1 AND expires_at > NOW()
            `;
    
            const [result] = await database.query(selectTokenQuery, [reset_token]);
    
            if (!result.length) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Invalid or expired reset token"
                });
            }
    
            const email_id = result[0].email_id;
            const hashedPassword = md5(new_password);
    
            const updatePasswordQuery = "UPDATE tbl_user SET passwords = ? WHERE email_id = ?";
            await database.query(updatePasswordQuery, [hashedPassword, email_id]);
    
            const deactivateTokenQuery = "UPDATE tbl_forgot_password SET is_active = 0 WHERE reset_token = ?";
            await database.query(deactivateTokenQuery, [reset_token]);
    
            return callback({
                code: response_code.SUCCESS,
                message: "Password reset successfully"
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error resetting password"
            });
        }
    }

    async complete_profile(requested_data, user_id, callback) {
        try {
            const userFetchQuery = "SELECT is_profile_completed FROM tbl_user WHERE user_id = ?";
            const [result] = await database.query(userFetchQuery, [user_id]);

            if (result[0].is_profile_completed === 1) {
                return callback({
                    code: response_code.SUCCESS,
                    message: "Profile is already complete",
                });
            } else{

                const { user_full_name, date_of_birth } = requested_data;

            if (!user_id || !user_full_name || !date_of_birth) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "All fields are required",
                });
            }
    
            if (result.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "User not found",
                });
            }

            const updateProfileQuery = `
                UPDATE tbl_user 
                SET user_full_name = ?, date_of_birth = ?, is_profile_completed = 1
                WHERE user_id = ?`;
            
            await database.query(updateProfileQuery, [user_full_name, date_of_birth, user_id]);
    
            const fetchUpdatedUserQuery = "SELECT * FROM tbl_user WHERE user_id = ?";
            const [updatedUser] = await database.query(fetchUpdatedUserQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: "Profile completed successfully",
                data: updatedUser[0],
            });

            }
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error updating profile",
            });
        }
    }

    async add_post(request_data, callback) {
        try {
            const { descriptions, expire_timer, post_type, category_id, user_id, media_names, tags } = request_data;
    
            if (!descriptions || !post_type || !category_id || !user_id || !media_names || media_names.length === 0) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "Missing required fields or media files",
                });
            }
    
            const mediaInsertQuery = "INSERT INTO tbl_image (image_name) VALUES ?";
            const mediaValues = media_names.map(name => [name]);
            const [mediaResult] = await database.query(mediaInsertQuery, [mediaValues]);
    
            const media_ids = [];
            for (let i = 0; i < media_names.length; i++) {
                media_ids.push(mediaResult.insertId + i);
            }
    
            const postInsertQuery = `
                INSERT INTO tbl_post (descriptions, expire_timer, share_cnt, avg_rating, post_type, category_id, user_id)
                VALUES (?, ?, 0, 0, ?, ?, ?)`;
            const [postResult] = await database.query(postInsertQuery, [descriptions, expire_timer, post_type, category_id, user_id]);
    
            const post_id = postResult.insertId;
    
            const postMediaRelationQuery = "INSERT INTO tbl_post_image_relation (post_id, image_id) VALUES ?";
            const postMediaValues = media_ids.map(media_id => [post_id, media_id]);
            await database.query(postMediaRelationQuery, [postMediaValues]);
    
            if (post_type === "toStyleCompare") {
                const subPostInsertQuery = `
                    INSERT INTO tbl_sub_post (post_id, image_id, avg_rating)
                    VALUES ?`;
                const subPostValues = media_ids.map(img_id => [post_id, img_id, 0.0]);
                await database.query(subPostInsertQuery, [subPostValues]);
            }
    
            if (tags && tags.length > 0) {
                for (let tag of tags) {
                    let tag_id;
    
                    const [existingTag] = await database.query("SELECT tag_id FROM tbl_tags WHERE tags = ?", [tag]);
    
                    if (existingTag.length > 0) {
                        tag_id = existingTag[0].tag_id;
                        await database.query("UPDATE tbl_tags SET tags_cnt = tags_cnt + 1 WHERE tag_id = ?", [tag_id]);
                    } else {
                        const [newTag] = await database.query("INSERT INTO tbl_tags (tags, tags_cnt) VALUES (?, 1)", [tag]);
                        tag_id = newTag.insertId;
                    }
    
                    await database.query("INSERT INTO tbl_post_tag (post_id, tag_id) VALUES (?, ?)", [post_id, tag_id]);
                }
            }
    
            const fetchPostQuery = `
                SELECT p.post_id, p.descriptions, p.expire_timer, p.post_type, p.category_id, p.user_id,
                       GROUP_CONCAT(i.image_name) AS media_files,
                       GROUP_CONCAT(t.tags) AS tags
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                LEFT JOIN tbl_post_tag pt ON pt.post_id = p.post_id
                LEFT JOIN tbl_tags t ON t.tag_id = pt.tag_id
                WHERE p.post_id = ?
                GROUP BY p.post_id
            `;
            const [createdPost] = await database.query(fetchPostQuery, [post_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: "Post added successfully",
                data: createdPost[0],
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error adding post",
            });
        }
    }

    async get_post_ranks(request_data, user_id, callback) {
        try {
            const { post_id } = request_data;
    
            if (!post_id) {
                return callback({
                    code: response_code.BAD_REQUEST,
                    message: "post_id is required"
                });
            }

            const postOwnerQuery = `SELECT p.user_id, p.expire_timer FROM tbl_post p inner join tbl_user u on u.user_id = p.user_id WHERE p.post_id = ? and u.is_login = 1`;
            const [postDetails] = await database.query(postOwnerQuery, [post_id]);

            if (postDetails.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Post not found or Login Required"
                });
            }
    
            const { user_id: owner_id, expire_timer } = postDetails[0];
            const isExpired = new Date() > new Date(expire_timer);
            if (user_id && user_id === owner_id && isExpired) {
                const rankQuery = `
                SELECT 
                    sp.image_id,
                    sp.avg_rating,
                    RANK() OVER (ORDER BY sp.avg_rating DESC) AS rank_no
                FROM tbl_sub_post sp
                INNER JOIN tbl_post p ON p.post_id = sp.post_id
                WHERE sp.post_id = ? AND NOW() > p.expire_timer
            `;
    
            const [rankResults] = await database.query(rankQuery, [post_id]);
            
            return callback({
                code: response_code.SUCCESS,
                message: "Rankings fetched successfully",
                data: rankResults
            });

            } else{
                const normalPostQuery = `
                SELECT 
                    p.post_id,
                    p.descriptions,
                    p.expire_timer,
                    p.share_cnt,
                    p.avg_rating,
                    p.post_type,
                    i.image_name
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                WHERE p.post_id = ?
            `;

            const [normalPost] = await database.query(normalPostQuery, [post_id]);

            return callback({
                code: response_code.SUCCESS,
                message: "Post details fetched successfully",
                data: normalPost
            });
            }
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error fetching rankings"
            });
        }
    }

    async trending_posts(request_data, callback) {
        try {
            const updateTrendingQuery = `
                UPDATE tbl_post p
                JOIN (
                    SELECT post_id
                    FROM (
                        SELECT post_id, COUNT(rating_id) AS total_ratings, AVG(rating) AS avg_rating
                        FROM tbl_rating
                        GROUP BY post_id
                        ORDER BY total_ratings DESC, avg_rating DESC
                        LIMIT 3
                    ) AS trending_post
                ) tp ON p.post_id = tp.post_id
                SET p.is_trending = 1
                WHERE is_active = 1 AND is_deleted = 0
            `;
    
            await database.query(updateTrendingQuery);
    
            const resetTrendingQuery = `
                UPDATE tbl_post 
                SET is_trending = 0 
                WHERE post_id NOT IN (
                    SELECT post_id FROM (
                        SELECT post_id
                        FROM tbl_rating
                        GROUP BY post_id
                        ORDER BY COUNT(rating_id) DESC, AVG(rating) DESC
                        LIMIT 3
                    ) AS trending
                )
            `;
    
            await database.query(resetTrendingQuery);
    
            const fetchTrendingPostsQuery = `
                SELECT p.post_id, i.image_name
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                WHERE p.is_trending = 1 AND p.is_active = 1 AND p.is_deleted = 0
            `;
    
            const [trendingPosts] = await database.query(fetchTrendingPostsQuery);
    
            return callback({
                code: response_code.SUCCESS,
                message: "Trending posts fetched successfully",
                data: trendingPosts
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error fetching trending posts"
            });
        }
    }
    
    async get_notifications(request_data, user_id, callback) {
        try {
            const selectUserQuery = "SELECT user_id FROM tbl_user WHERE is_login = 1 AND user_id = ?";
            const [userResult] = await database.query(selectUserQuery, [user_id]);
    
            if (userResult.length === 0) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "Login Required or User not found",
                });
            }
    
            const getNotificationQuery = `
                SELECT cover_image, title, descriptions 
                FROM tbl_notification 
                WHERE user_id = ? 
                ORDER BY created_at DESC;
            `;
            const [notifications] = await database.query(getNotificationQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: notifications.length > 0 ? "Here are your notifications..." : "No notifications found",
                data: notifications,
            });
    
        } catch (error) {
            console.error("Error fetching notifications:", error);
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "An error occurred while fetching notifications",
                error: error.message
            });
        }
    }

    async follow_user(request_data, user_id, callback) {
        try {
            const { follow_id } = request_data;
    
            if (!follow_id) {
                return callback({
                    code: response_code.BAD_REQUEST,
                    message: "Follow ID is required",
                });
            }
    
            const checkFollowQuery = "SELECT * FROM tbl_follow WHERE user_id = ? AND follow_id = ?";
            const [existingFollow] = await database.query(checkFollowQuery, [user_id, follow_id]);
    
            if (existingFollow.length > 0) {
                return callback({
                    code: response_code.ALREADY_EXISTS,
                    message: "You are already following this user",
                });
            }
    
            const followQuery = "INSERT INTO tbl_follow (user_id, follow_id) VALUES (?, ?)";
            await database.query(followQuery, [user_id, follow_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: "User followed successfully",
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "Error occurred while following user",
                data: error.message || error,
            });
        }
    }
    
    async rate_post(request_data, user_id, callback) {
        try {
            const { post_id, rating, sub_post_id } = request_data;
    
            if (!post_id || !rating || rating < 1 || rating > 5) {
                return callback({
                    code: response_code.BAD_REQUEST,
                    message: "Invalid post_id or rating (must be between 1-5)",
                });
            }
    
            const fetchPostTypeQuery = "SELECT post_type FROM tbl_post WHERE post_id = ?";
            const [post] = await database.query(fetchPostTypeQuery, [post_id]);
    
            if (post.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Post not found",
                });
            }
    
            const post_type = post[0].post_type;
    
            if (post_type === "toStyleCompare") {
                if (!sub_post_id) {
                    return callback({
                        code: response_code.BAD_REQUEST,
                        message: "sub_post_id is required for toStyleCompare",
                    });
                }
    
                const checkSubpostQuery = "SELECT * FROM tbl_sub_post WHERE sub_post_id = ?";
                const [subpost] = await database.query(checkSubpostQuery, [sub_post_id]);
    
                if (subpost.length === 0) {
                    return callback({
                        code: response_code.NOT_FOUND,
                        message: "Subpost not found",
                    });
                }
                const checkRatingQuery = "SELECT * FROM tbl_sub_post_rating WHERE sub_post_id = ? AND user_id = ?";
                const [existingRating] = await database.query(checkRatingQuery, [sub_post_id, user_id]);
    
                if (existingRating.length > 0) {
                
                    const updateQuery = "UPDATE tbl_sub_post_rating SET rating = ?, updated_at = NOW() WHERE sub_post_id = ? AND user_id = ?";
                    await database.query(updateQuery, [rating, sub_post_id, user_id]);
                } else {
                    const insertQuery = "INSERT INTO tbl_sub_post_rating (sub_post_id, user_id, rating) VALUES (?, ?, ?)";
                    await database.query(insertQuery, [sub_post_id, user_id, rating]);
                }
    
            } else {
                const checkRatingQuery = "SELECT * FROM tbl_rating WHERE post_id = ? AND user_id = ?";
                const [existingRating] = await database.query(checkRatingQuery, [post_id, user_id]);
    
                if (existingRating.length > 0) {
                    const updateQuery = "UPDATE tbl_rating SET rating = ?, updated_at = NOW() WHERE post_id = ? AND user_id = ?";
                    await database.query(updateQuery, [rating, post_id, user_id]);
                } else {
                    const insertQuery = "INSERT INTO tbl_rating (post_id, user_id, rating) VALUES (?, ?, ?)";
                    await database.query(insertQuery, [post_id, user_id, rating]);
                }
            }
    
            return callback({
                code: response_code.SUCCESS,
                message: `Rating added successfully for ${post_type}`,
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error adding rating",
            });
        }
    }

    async get_profile(request_data, user_id, callback){
        try{
            var getUserQuery = `select u.user_name, 
                            u.user_full_name, 
                            u.descriptions, 
                            u.profile_pic, 
                            u.follower_cnt, 
                            u.following_cnt, 
                            u.rating_cnt, 
                            i.image_name
                            from tbl_user as u 
                            left join tbl_post as p 
                            on u.user_id = p.user_id 
                            left join tbl_sub_post as sp 
                            on sp.post_id = p.post_id
                            left join tbl_image as i 
                            on i.image_id = sp.image_id
                            where u.user_id = ? and u.is_login = 1 and u.is_active = 1 and u.is_deleted = 0`;

            const [results] = await database.query(getUserQuery, [user_id]);
            if(results.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "No Users Found"
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: "User Profile",
                data: results
            });
        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            });
        }   
    }

    async get_other_profile(request_data, user_id, callback){
        try{
            var getUserQuery = `select u.user_name, 
                            u.user_full_name, 
                            u.descriptions, 
                            u.profile_pic, 
                            u.follower_cnt, 
                            u.following_cnt, 
                            u.rating_cnt, 
                            i.image_name
                            from tbl_user as u 
                            left join tbl_post as p 
                            on u.user_id = p.user_id 
                            left join tbl_sub_post as sp 
                            on sp.post_id = p.post_id
                            left join tbl_image as i 
                            on i.image_id = sp.image_id
                            where u.user_id = ? and u.is_active = 1 and u.is_deleted = 0`;

            const [results] = await database.query(getUserQuery, [user_id]);
            if(results.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "No Users Found"
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: "User Profile",
                data: results
            });

        }catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            });
        }
    }
    
    
}

module.exports = new userModel();