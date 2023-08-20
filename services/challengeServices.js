const { sequelize, Op } = require("../config/db");
const { challengeCategories, challengeStatus } = require("../constants");
const { ApiBadRequestError } = require("../errors");
const { Challenge, Result, User } = require("../models");
const { generateRandomNumber } = require("../utils");

class challengeServices {
  async createChallenge(challenger, category, price) {
    console.log(challenger);
    console.log(category);
    console.log(price);
    const runningUserChallenges = await Challenge.scope("running").findAll({
      where:{
        [Op.or]:[
          {
            challenger: challenger,
          },
          {
            acceptor: challenger,
          }
        ]

      }
    });
    const existingUserChallenges = await Challenge.scope("created").findAll({
      where:{
        [Op.or]:[
          {
            challenger: challenger,
          },
          {
            acceptor: challenger,
          }
        ]

      }
    });

    if (runningUserChallenges?.length > 1) {
      throw new ApiBadRequestError(
        "You already have 2 challenges ongoing, please complete them before creating new."
      );
    }
    if (existingUserChallenges?.length > 1) {
      throw new ApiBadRequestError(
        "You already have 2 challenges created, please cancel them before creating new."
      );
    }
    const roomcode = generateRandomNumber(10000, 99999);
    const rslt = await Challenge.create({
      challenger,
      category,
      price,
      status: "created",
      roomcode,
    });

    return rslt;
  }
  async getChallenges(status, category, price, challenger, acceptor,limit,offset) {
    const whereCondition = {};

    if (status !== undefined) {
      whereCondition.status = status;
    }

    if (category !== undefined) {
      whereCondition.category = category;
    }

    if (price !== undefined) {
      whereCondition.price = price;
    }

    if (challenger !== undefined) {
      whereCondition.challenger = challenger;
    }

    if (acceptor !== undefined) {
      whereCondition.acceptor = acceptor;
    }

    const rslt = await Challenge.findAndCountAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      where: whereCondition,
      include: [
          {
              model: Result
          },
          {
              model: User,
              as: 'ChallengerUser',
              attributes: ["username", "id", "name"]
          },
          {
              model: User,
              as: 'AcceptorUser',
              attributes: ["username", "id", "name"]
          }
      ]
  });
  return rslt;
  }
  async acceptChallenge(acceptor, challengeId) {
    // const t1 = await sequelize.transaction();
    const result = await sequelize      .transaction(async (t1) => {
      const rslt = await Challenge.findByPk(challengeId, {
        skipLocked: true,
        lock: true,
        transaction: t1,
      });
      console.log("accept challenge rslt", rslt)
      if (!rslt) {
        throw new ApiBadRequestError(
          "No challenge found with challengeId " + challengeId
        );
      }
      if (rslt.acceptor) {
        throw new ApiBadRequestError(
          "The requested challenge is already running"
        );
      }
      if(rslt.challenger == acceptor){
        throw new ApiBadRequestError("This challenge was created by you. You cannot accept your own challenge")
      }
      if(rslt.status == challengeStatus.CANCELLED){
        throw new ApiBadRequestError(
            "Cancelled challenge"
        )
      }
      if(rslt.status = challengeStatus.CREATED){

          rslt.acceptor = acceptor;
          rslt.status = challengeStatus.RUNNING;
          await rslt.save({transaction:t1})
          return rslt
      }


    });
    return result
  }
}

module.exports = new challengeServices();
