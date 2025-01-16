import express, { Request, Response } from 'express';
import { DataTypes, Model, Sequelize } from 'sequelize'
import dotenv from 'dotenv';
import { PersonType } from './types/PersonType';
import { CardType } from './types/CardType';
import { EntityType } from './types/EntityType';
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

const Escorts = sequelize.define(
    'escorts',
    {
        personEscort: {
            type: DataTypes.STRING
        }
    }
);

const Functions = sequelize.define(
    'functions',
    {
        personFunction: {
            type: DataTypes.STRING
        }
    }
);

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
        },
        escort: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const Entity = sequelize.define(
    'entities',
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

const CardsIssues = sequelize.define(
    'cards_issues',
    {
        cardId: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    }
);

Person.belongsTo(Entity, {
    foreignKey: {
        name: 'entityId',
        allowNull: false,
    },
    as: 'entity'
});

Card.belongsTo(Person, {
    foreignKey: {
        name: 'personId',
        allowNull: false,
    },
    as: 'person'
});

Person.sync()
Card.sync()
Functions.sync()
Escorts.sync()
Entity.sync()
CardsIssues.sync()

app.post('/card/save', async (req: Request<{}, {}, PersonType & CardType>, res: Response) => {
    try {
        const body = req.body
        const entity = await Entity.findOne<Model<{ name: string, id: number }>>({where: { name: body.entity }});
        console.log(entity?.dataValues)
        const data = entity?.dataValues;

        const person = await Person.create({ name: body.name, job: body.job, escort: body.escort, entityId: data?.id })
        await Card.create({ expiration: body.expiration, cardNumber: body.cardNumber, personId: person.dataValues.id });

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/card/issue', async (req: Request<{}, {}, { cardId: string }>, res: Response) => {
    try {
        const body = req.body
        await CardsIssues.create({ cardId: body.cardId });

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/function/save', async (req: Request<{}, {}, { personFunction: string }>, res: Response) => {
    try {
        const body = req.body
        console.log(body)
        await Functions.create({ personFunction: body.personFunction })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/escort/save', async (req: Request<{}, {}, { personEscort: string }>, res: Response) => {
    try {
        const body = req.body
        await Escorts.create({ personEscort: body.personEscort })

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(501).send(error)
    }
});

app.post('/setup/entity/save', async (req: Request<{}, {}, { name: string }>, res: Response) => {
    try {
        const body = req.body;
        await Entity.create({ name: body.name });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(501).send(error);
    }
});

app.get('/cardIssues/getAll', async (_: Request, res: Response) => {
    const entities = await CardsIssues.findAll<Model<{ cardId: string }>>();
    res.status(200).json(entities);
});

app.get('/setup/entity/getAll', async (_: Request, res: Response) => {
    const entities = await Entity.findAll<Model<{ name: string }>>();
    res.status(200).json(entities);
});

app.get('/card/getAll', async (_: Request, res: Response) => {
    const persons = await Card.findAll<Model<PersonType>>({
        include: {
            model: Person,
            as: 'person',
            include: [{
                model: Entity,
                as: 'entity' 
            }]
        },
    })

    res.status(200).json(persons)
})
app.get('/setup/function/getAll', async (_: Request, res: Response) => {
    const funs = await Functions.findAll<Model<{ personFunction: string }>>()
    res.status(200).json(funs)
})

app.get('/setup/escort/getAll', async (_: Request, res: Response) => {
    const escorts = await Escorts.findAll<Model<{ personEscort: string }>>()
    res.status(200).json(escorts)
})

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});