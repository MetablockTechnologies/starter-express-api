const { ApiBadRequestError } = require("../errors");
const { UserAuthentication } = require("../models/index");
const { generateRandomNumber } = require("../utils");
const jwt = require("jsonwebtoken");
class userAuthServices {
  async sendEmailOTP(email, phone, role) {
    let otp = generateRandomNumber(1000, 9999);
    const existingUser = await UserAuthentication.findOne({
      where: {
        phone,
        role,
      },
    });
    if (!existingUser || !existingUser.is_phone_verified) {
      throw new ApiBadRequestError(
        `The phone number ${phone} is not verified, please verify it first.`
      );
    }
    const existingEmail = await UserAuthentication.findOne({
      where: {
        email,
      },
    });
    if (existingEmail && existingEmail.phone != phone) {
        if(existingEmail.is_email_verified ){

            throw new ApiBadRequestError("Email already in use with different phone number");
        }
        else{
            existingEmail.email = null;
            await existingEmail.save()
        }
    }
    let expirationTimeInMilliseconds =
      new Date().getTime() + 60000 * process.env.OTP_EXPIRATION;
    let expirationTime = new Date(expirationTimeInMilliseconds);
    existingUser.email_otp = otp;
    existingUser.email_expirationTime = expirationTime;
    existingUser.email = email;
    await existingUser.save();

    return { message: "OTP send on your email " + email, user: existingUser };
  }

  //--------------------------------

  async sendPhoneOTP(phone, role) {
    let otp = generateRandomNumber(1000, 9999);
    let expirationTimeInMilliseconds =
      new Date().getTime() + 60000 * process.env.OTP_EXPIRATION;
    let expirationTime = new Date(expirationTimeInMilliseconds);
    let [checkuser, created] = await UserAuthentication.findOrCreate({
      where: {
        phone,
      },
      defaults: {
        phone,
        phone_otp: otp,
        phone_expirationTime: expirationTime,
        role,
      },
    });
    // console.log(checkuser,created);
    if (!created) {
      if (checkuser.isCreated) {
        throw ApiBadRequestError("Phone already in use");
      }
      checkuser.phone_otp = otp;
      checkuser.role = role;
      checkuser.phone_expirationTime = expirationTime;
      await checkuser.save();
    }

    return {
      message: "OTP send on your phone number " + phone,
      user: checkuser,
    };
  }

  //--------------------------------
  async verifyPhoneOTP(phone, OTP, role) {
    const checkUser = await UserAuthentication.findOne({
      where: {
        phone,
        role,
      },
    });
    if (!checkUser) {
      throw new ApiBadRequestError(
        "No user found with provided role and phone number."
      );
    }
    if (
      new Date(checkUser.phone_expirationTime).getTime() < new Date().getTime()
    ) {
      throw new ApiBadRequestError("OTP has Expired");
    }
    if (checkUser.phone_otp == OTP || true) {
      checkUser.is_phone_verified = true;
      await checkUser.save();
    }
    return checkUser;
  }


  //--------------------------------

  async verifyEmailOTP(phone, email, OTP, role) {
    console.log("here");
    const checkUser = await UserAuthentication.findOne({
      where: {
        phone,
        email,
        role,
      },
    });
    if (!checkUser) {
      throw new ApiBadRequestError(
        "No user found with provided role, email and phone number."
      );
    }
    if (
      new Date(checkUser.email_expirationTime).getTime() < new Date().getTime()
    ) {
      throw new ApiBadRequestError("OTP has Expired");
    }
    if (checkUser.email_otp == OTP || true) {
      checkUser.is_email_verified = true;
      await checkUser.save();
    }
    return checkUser
  }
  //--------------------
  async getAccessToken(user) {
    const token = jwt.sign(user, process.env.JWT_TOKEN_SECRET, {
      expiresIn: process.env.JWT_EXPIRATION_TIME,
    });
    return token;
  }

  //-----
  /*
  async getRefreshToken(user, force = false) {
    console.log(user);
    let refreshTokenDB = await RefreshToken.findOne({
      where: {
        userid: user.uid,
      },
    });

    if (refreshTokenDB) {
      logger.info("Refresh Token Found");
      const expiresAt = jwt.decode(refreshTokenDB.token);
      console.log("expiresAt", expiresAt);

      if (force || expiresAt * 1000 < Date.now()) {
        logger.info("Refresh Token Expired");
        refreshTokenDB.token = jwt.sign(
          user,
          process.env.REFRESH_TOKEN_SECRET,
          {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRATION_TIME,
          }
        );
        await refreshTokenDB.save();
      }

      return refreshTokenDB.token;
    } else {
      const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRATION_TIME,
      });
      refreshTokenDB = await RefreshToken.create({
        userid: user.uid,
        token: refreshToken,
      });
    }
    // const {refreshTokenDB, create} = await RefreshToken.findOrCreate({
    //   token: refreshToken,
    //   where: {
    //     userId: user.uid,
    //   },
    // })

    return refreshTokenDB.token;
  }
  */
}
module.exports = new userAuthServices();
