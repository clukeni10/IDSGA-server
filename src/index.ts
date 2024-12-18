import express, { Request, Response } from 'express';
import { DataTypes, Model, Sequelize } from 'sequelize'
import dotenv from 'dotenv';
import { PersonType } from './types/PersonType';
import { CardType } from './types/CardType';
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());

const sequelize = new Sequelize('sga_cards', 'root', 'sga-card', {
    host: 'localhost',
    dialect: 'mysql'
});

try {
    sequelize.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

const Card = sequelize.define(
    'cards',
    {
        expiration: {
            type: DataTypes.DATE
        },
        cardNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Person = sequelize.define(
    'persons',
    {
        name: {
            type: DataTypes.STRING
        },
        job: {
            type: DataTypes.STRING
        }
    }
);

Card.belongsTo(Person, {
    foreignKey: {
        name: 'personId',
        allowNull: false,
    },
    as: 'person'
});

Person.sync()
Card.sync()

app.post('/card/save', async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body
        const person = await Person.create({ name: body.name, job: body.job })
        await Card.create({ expiration: body.expiration, cardNumber: body.cardNumber, personId: person.dataValues.id });

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.get('/card/getAll', async (_: Request, res: Response) => {
    const persons = await Card.findAll<Model<PersonType>>({
        include: {
            model: Person,
            as: 'person',
        },
    })

    res.status(200).json(persons)
})

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});