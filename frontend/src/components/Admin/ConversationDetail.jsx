import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Timeline, Button, Tag, Spin, Empty, message as antMessage, Descriptions } from 'antd';
import { ArrowLeftOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { chatAPI } from '../../services/api';
import styles from './ConversationDetail.module.css';
import { formatUTCDateTimeCN } from '../../utils/timeUtils';

const ConversationDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [customer, setCustomer] = useState(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getConversations(customerId);
      setConversations(response.data);
      
      // Fetch customer info
      const customersResponse = await chatAPI.getCustomers();
      const customerData = customersResponse.data.find(c => c.id === parseInt(customerId));
      setCustomer(customerData);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      antMessage.error('Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [customerId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const getCategoryTag = (category, priority) => {
    const config = {
      HIGH_VALUE: { color: 'red', text: 'High Value' },
      NORMAL: { color: 'green', text: 'Normal' },
      LOW_VALUE: { color: 'default', text: 'Low Value' }
    };
    const { color, text } = config[category] || config.NORMAL;
    return <Tag color={color}>{text} (Priority: {priority})</Tag>;
  };

  return (
    <div style={{ padding: 24 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/customers')}
        style={{ marginBottom: 16 }}
      >
        Back to Customer List
      </Button>

      {customer && (
        <Card title="Customer Info" style={{ marginBottom: 24 }}>
          <Descriptions>
            <Descriptions.Item label="Name">
              <strong>{customer.name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Email">{customer.email}</Descriptions.Item>
            <Descriptions.Item label="Company">{customer.company || '-'}</Descriptions.Item>
            <Descriptions.Item label="Category">
              {getCategoryTag(customer.category, customer.priority_score)}
            </Descriptions.Item>
            <Descriptions.Item label="Created At (UTC)">
              {formatUTCDateTimeCN(customer.created_at)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="Conversation History">
        {conversations.length === 0 ? (
          <Empty description="No conversation records" />
        ) : (
          conversations.map((conversation) => (
            <div key={conversation.id} style={{ marginBottom: 32 }}>
              <h4>
                Session #{conversation.id}
                <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 16 }}>
                  {formatUTCDateTimeCN(conversation.created_at)}
                </span>
              </h4>

              <Timeline>
                {conversation.messages && conversation.messages.map((message) => (
                  <Timeline.Item
                    key={message.id}
                    dot={
                      message.sender === 'CUSTOMER' ?
                      <UserOutlined style={{ fontSize: 16 }} /> :
                      <RobotOutlined style={{ fontSize: 16 }} />
                    }
                    color={message.sender === 'CUSTOMER' ? 'blue' : 'green'}
                  >
                    <div className={styles.messageItem}>
                      <div className={styles.messageHeader}>
                        <Tag color={message.sender === 'CUSTOMER' ? 'blue' : 'green'}>
                          {message.sender === 'CUSTOMER' ? 'Customer' : 'AI'}
                        </Tag>
                        <span className={styles.messageTime}>
                          {formatUTCDateTimeCN(message.created_at)}
                        </span>
                        {message.ai_confidence !== undefined && (
                          <Tag>Confidence: {(message.ai_confidence * 100).toFixed(0)}%</Tag>
                        )}
                      </div>
                      <div className={styles.messageContent}>
                        {message.sender === 'AI' ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default ConversationDetail;
