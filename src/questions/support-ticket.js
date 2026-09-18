import { choice, noul, score } from '@typesafe-ai/sdk';

// The support ticket example from https://docs.typesafe.ai/introduction/quickstart

export const sampleTicket =
  "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.";

export const supportTicketQuestions = {
  department: choice('Which team should handle this', {
    billing: 'Payment or subscription issues',
    technical: 'Bugs or integration problems',
    sales: 'Pricing or account questions',
  }),
  frustration: score('How frustrated the customer appears', [
    'Calm, just stating facts',
    'Frustrated but civil',
    'Very angry, strong language',
  ]),
  is_urgent: noul('The message conveys urgency or time-sensitivity'),
};
