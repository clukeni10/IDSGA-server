'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('persons', 'escort', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'active',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remover a coluna 'status' da tabela 'cards'
  },
};