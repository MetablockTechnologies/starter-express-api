const {
  Api404Error,
  ApiUnathorizedError,
  ApiBadRequestError,
} = require("../errors");
const { Admin, Request, WithdrawRequest, User, Challenge, Result, Wallet } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userAuthServices = require("./userAuthServices");
const walletServices = require("../services/walletServices");
const { sequelize, Op } = require("../config/db");
class adminServices {
  async login(email, password) {
    const admin = await Admin.findOne({
      where: {
        email: email,
      },
      attributes: {
        exclude: ["createdAt", "updatedAt"],
      },
    });
    if (!admin) {
      throw new Api404Error("No account found with this email");
    }
    const salt = await bcrypt.genSaltSync(10);
    // logger.debug("user",user)
    // logger.debug(password,user.password)
    const verified = await bcrypt.compare(password, admin.password);

    // const verified = password == admin.password;
    if (verified) {
      const adminWithoutPassword = { ...admin.toJSON() };
      delete adminWithoutPassword.password;
      return {
        token: await userAuthServices.getAccessToken({
          uid: admin.id,
          role: "admin",
        }),
        user: adminWithoutPassword,
      };
    } else {
      throw new ApiUnathorizedError(
        "Given email/password combination is invalid"
      );
    }
  }

  async createAdmin(phone, email, name, username, password) {
    let admin = await Admin.findOne({
      where: {
        status:"active",
        [Op.or]: [
          {
            phone,
          },
          {
            email,
          },
          {
            name,
          },
          {
            username,
          },
        ],
      },
    });
    if (admin) {
      let errorFields = [];

      if (admin.phone === phone) errorFields.push("phone");
      if (admin.email === email) errorFields.push("email");
      if (admin.name === name) errorFields.push("name");
      if (admin.username === username) errorFields.push("username");

      let errorMessage = `A admin already exists with the following field(s): ${errorFields.join(
        ", "
      )}`;
      throw new ApiBadRequestError(errorMessage);
    } 
    const salt = await bcrypt.genSaltSync(10);
    password = bcrypt.hashSync(password, salt);
    admin = await Admin.create({
      phone, email, name, username, password,status:"active"
    })
    return admin;
    
  }
  async getCoinRequests(){
    const requests = await Request.findAll({
      include:[
        {
          model:User,
          attributes:["username","name","id","email","phone"]
            
          
        }
      ],
      order:[
        ["createdAt","DESC"]
      ]
    })
    return requests
  }
  async getWithdrawRequest(){

    const requests = await WithdrawRequest.findAll({
      include:[
        {
          model:User,
          attributes:["username","name","id","email","phone"],
          include:[
            {
              model:Wallet,
              
            }
          ]
          
        }
      ]
    })
    return requests 
  }
  async getChallengeResults(){
    const requests = await Challenge.findAll({
      where:{
        status:"judgement"
      },
      include:[
        {
          model: Result,
          
          include: [
            {
              model: User,
              as: "WinnerUser",
              attributes: ["username", "id", "name"],
            },
          ],
        },
        {
          model: User,
          as: "ChallengerUser",
          attributes: ["username", "id", "name"],
        },
        {
          model: User,
          as: "AcceptorUser",
          attributes: ["username", "id", "name"],
        },
      ]
    })
    return requests
  }

  async updateCoinRequest(id,message,status,adminId,amount){
    const request = await Request.findOne({
      where:{
        id
      }
    })
    if(request.status != "pending"){
      throw new ApiBadRequestError(`This request is already ${request.status}`)
    }
    request.message = message
    request.status = status
    request.admin = adminId
    if(status=="accepted"){
      request.amount = amount
    }
    await request.save()
    if(status == "accepted"){
      await walletServices.addCoins(request.amount,request.userId)
      await walletServices.addCoins(request.amount,request.userId,"bought")
    }
    return request
  }
  async updateWithdrawRequest(id,message,status,adminId,amount){
    const request = await WithdrawRequest.findOne({
      where:{
        id
      }
    })
    if(request.status != "pending"){
      throw new ApiBadRequestError(`This request is already ${request.status}`)
    }
    request.message = message
    request.status = status
    request.admin = adminId
    if(status=="accepted"){
      request.amount = amount
    }
    await request.save()
    if(status == "accepted"){
      await walletServices.withdrawCoins(request.amount,request.userId)
      await walletServices.withdrawCoins(request.amount,request.userId,"withdrawn")
    }
    return request
  }
}

module.exports = new adminServices();
